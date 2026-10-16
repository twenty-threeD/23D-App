// 채팅 메시지 로컬 캐시 (SQLite)
//
// 서버가 메시지를 DB 에 영구 저장하므로 여기는 진실 원본이 아니라 "렌더 캐시"다.
// 방 진입 시 네트워크를 기다리지 않고 바로 그리기 위해서만 쓰며, 언제 지워져도
// 커서 페이지네이션으로 서버에서 다시 받아오면 된다. "로컬에 없으면 에러" 같은 분기를 만들지 않는다.
// 웹은 IndexedDB 를 썼는데 앱에는 없어 SQLite 로 같은 동작을 옮겼다.
import * as SQLite from 'expo-sqlite'
import { parseDate } from './date'

const DB_NAME = '23d-chat.db'
// 3: messageId 가 방별 카운터에서 전역 PK 로 바뀐 뒤의 스키마(웹 IndexedDB v3 와 같은 기준).
// 예전 캐시의 id 를 after/cursor 로 보내면 엉뚱한 구간이 돌아오므로, 버전이 다르면 테이블을 버리고 새로 만든다
const SCHEMA_VERSION = 3

// 캐시가 실제로 필요로 하는 최소 형태. 나머지 필드는 그대로 통과시킨다.
export interface ChatMessageKey {
  // 전역 PK. 정렬·중복 제거·after/cursor 기준이다.
  messageId?: number | null
  roomId: number
  createdAt: string // ISO-8601
}

export interface CachedMessage extends ChatMessageKey {
  [key: string]: unknown
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function openDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME)
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
      if ((row?.user_version ?? 0) !== SCHEMA_VERSION) {
        // clearBefore 비교를 SQL 로 하려고 createdAt 을 밀리초로도 저장한다(파싱 못 한 값은 NULL 이라 지워지지 않는다)
        await db.execAsync(`
          DROP TABLE IF EXISTS messages;
          CREATE TABLE messages (
            messageId INTEGER PRIMARY KEY NOT NULL,
            roomId INTEGER NOT NULL,
            createdAtMs INTEGER,
            body TEXT NOT NULL
          );
          CREATE INDEX idx_messages_room ON messages (roomId);
          PRAGMA user_version = ${SCHEMA_VERSION};
        `)
      }
      return db
    })().catch((error) => {
      // 여는 데 실패하면 다음 호출에서 다시 시도한다
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

function toMs(createdAt: string) {
  const time = parseDate(createdAt)
  return Number.isNaN(time) ? null : time
}

// 방 하나의 캐시된 메시지를 messageId 오름차순으로 반환
export async function getCachedMessages(roomId: number): Promise<CachedMessage[]> {
  const db = await openDb()
  // createdAt 은 같은 시각이 겹칠 수 있어 전역 PK 로 정렬한다
  const rows = await db.getAllAsync<{ body: string }>('SELECT body FROM messages WHERE roomId = ? ORDER BY messageId ASC', roomId)
  const list: CachedMessage[] = []
  for (const row of rows) {
    try {
      list.push(JSON.parse(row.body) as CachedMessage)
    } catch {
      // 깨진 행은 건너뛴다. 서버 동기화가 다시 채운다
    }
  }
  return list
}

// 메시지를 캐시에 upsert 한다 (messageId 가 같으면 덮어쓴다)
export async function cacheMessages<T extends ChatMessageKey>(messages: T[]): Promise<void> {
  // id 없는 메시지는 키를 만들 수 없다. 다음 동기화 때 서버에서 id 와 함께 다시 온다.
  const rows = messages.filter((m) => m?.messageId != null)
  if (rows.length === 0) return
  const db = await openDb()
  await db.withTransactionAsync(async () => {
    for (const message of rows) {
      await db.runAsync(
        'INSERT OR REPLACE INTO messages (messageId, roomId, createdAtMs, body) VALUES (?, ?, ?, ?)',
        message.messageId as number,
        message.roomId,
        toMs(message.createdAt),
        JSON.stringify(message),
      )
    }
  })
}

// clearBefore 이전(같은 시각 포함) 메시지를 지운다.
// 방을 나갔다가 다시 들어왔을 때 예전 대화가 남지 않게 하는 핵심 로직.
export async function clearMessagesBefore(roomId: number, clearBefore: string | null): Promise<void> {
  if (!clearBefore) return
  // 문자열 그대로 비교하지 않고 파싱해서 비교한다. 서버와 로컬의 타임존 표기나 밀리초 자릿수가 달라도 안전하게 하기 위함
  const threshold = toMs(clearBefore)
  if (threshold == null) return
  const db = await openDb()
  await db.runAsync('DELETE FROM messages WHERE roomId = ? AND createdAtMs <= ?', roomId, threshold)
}

// 여러 방의 clearBefore 를 한 번에 정리 (GET /api/chat/rooms 응답용). 한 트랜잭션에서 전부 처리한다.
export async function clearRoomsBefore(rooms: { roomId: number; clearBefore?: string | null }[]): Promise<void> {
  // 나간 적 있는 방만 대상이다 (clearBefore 가 null 이면 지울 게 없다)
  const targets = rooms
    .map((room) => ({ roomId: room.roomId, threshold: room.clearBefore ? toMs(room.clearBefore) : null }))
    .filter((t): t is { roomId: number; threshold: number } => t.roomId != null && t.threshold != null)
  if (targets.length === 0) return

  const db = await openDb()
  await db.withTransactionAsync(async () => {
    for (const { roomId, threshold } of targets) {
      await db.runAsync('DELETE FROM messages WHERE roomId = ? AND createdAtMs <= ?', roomId, threshold)
    }
  })
}

// 방 하나의 캐시를 통째로 비운다
export async function deleteRoomCache(roomId: number): Promise<void> {
  const db = await openDb()
  await db.runAsync('DELETE FROM messages WHERE roomId = ?', roomId)
}

// 모든 방의 캐시를 비운다. DB 가 계정 구분 없이 하나라, 로그아웃·다른 계정 로그인 때 비우지 않으면
// 같은 기기를 쓰는 다음 사람이 이전 사람의 대화 기록을 읽을 수 있다
export async function clearAllChatCache(): Promise<void> {
  const db = await openDb()
  await db.runAsync('DELETE FROM messages')
}
