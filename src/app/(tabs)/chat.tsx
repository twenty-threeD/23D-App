import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import { Avatar } from '@/components/PostImage'
import LoginRequired from '@/components/LoginRequired'
import { colors, FONT_FAMILY, PAGE_X, radius } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useChatRoomsStore, type ChatRoom, type TradeStatus } from '@/store/chatRoomsStore'
import { deleteChatRoom, getChatMessages, getChatRooms, unwrap } from '@/lib/chat'
import { invalidate } from '@/lib/cache'
import { roomPreviewOf } from '@/lib/chatPreview'
import { formatTime } from '@/lib/date'
import { confirm } from '@/lib/dialog'
import { useHandleError } from '@/hooks/useHandleError'

type Tab = 'all' | 'received' | 'done'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'received', label: '받은거래' },
  { key: 'done', label: '완료된 거래' },
]

// 미리보기가 "새 메시지" 로만 남은 옛 방을 이미 원문으로 채웠는지. 화면을 다시 열 때마다 또 받지 않게 모듈에 둔다
const legacyCheckedRooms = new Set<number>()

// 거래 상태는 서버가 관리한다. 값이 없으면(상태 컬럼 이전 방) 진행 중으로 본다
function tradeStatusOf(room?: ChatRoom): TradeStatus {
  return room?.tradeStatus ?? 'IN_PROGRESS'
}

export default function Page() {
  const token = useAuthStore((s) => s.accessToken)
  const handleError = useHandleError()
  const rooms = useChatRoomsStore((s) => s.rooms)
  const loaded = useChatRoomsStore((s) => s.loaded)
  const setRooms = useChatRoomsStore((s) => s.setRooms)
  const unreadRoomIds = useChatRoomsStore((s) => s.unreadRoomIds)
  const lastMessageOverride = useChatRoomsStore((s) => s.lastMessageOverride)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchRooms = useCallback(async () => {
    const current = useAuthStore.getState().accessToken
    if (!current) return
    try {
      const res = await getChatRooms(current)
      setRooms(unwrap<ChatRoom[]>(res) ?? [])
    } catch {
      setRooms([])
    }
  }, [setRooms])

  // 다른 화면(채팅방·결제)에서 상태가 바뀌었을 수 있어 탭에 돌아올 때마다 다시 받는다(짧은 캐시가 연달아 받는 걸 막는다)
  useFocusEffect(
    useCallback(() => {
      if (token) void fetchRooms()
    }, [token, fetchRooms]),
  )

  // 백엔드가 예전에 미리보기를 전부 "새 메시지"로 저장해서, 그때 끝난 거래 방은 목록만 보고는 완료·취소를 알 수 없다.
  // 끝난 방엔 새 메시지가 오지 않아 저절로 고쳐지지도 않으므로, 그런 방만 마지막 메시지를 한 번 받아 원문으로 채운다
  useEffect(() => {
    if (!token) return
    for (const room of rooms) {
      if (room.lastMessagePreview !== '새 메시지' || legacyCheckedRooms.has(room.roomId)) continue
      legacyCheckedRooms.add(room.roomId)
      getChatMessages(token, room.roomId)
        .then((json) => {
          const list = unwrap<{ message?: string }[] | { content?: { message?: string }[] }>(json)
          const arr = Array.isArray(list) ? list : list?.content ?? []
          const last = arr[arr.length - 1]?.message
          if (!last) return
          useChatRoomsStore.setState((st) =>
            st.lastMessageOverride[room.roomId] != null ? st : { lastMessageOverride: { ...st.lastMessageOverride, [room.roomId]: last } },
          )
        })
        .catch(() => {})
    }
  }, [rooms, token])

  async function handleRefresh() {
    setRefreshing(true)
    invalidate('me:chat-rooms')
    await fetchRooms()
    setRefreshing(false)
  }

  async function handleDeleteRoom(room: ChatRoom) {
    if (!token) return
    if (!(await confirm(`${room.participantName}님과의 채팅방을 삭제하시겠습니까?`, { confirmText: '삭제', destructive: true }))) return
    try {
      await deleteChatRoom(token, room.roomId)
      setRooms(useChatRoomsStore.getState().rooms.filter((r) => r.roomId !== room.roomId))
    } catch (e) {
      void handleError(e)
    }
  }

  if (!token) return <LoginRequired message="채팅은 로그인한 뒤 이용할 수 있어요." />

  // 거래가 끝난 방은 더 챙길 일이 없어 목록 맨 아래로 보낸다. 나머지 순서(최근 메시지 순)는 그대로 둔다
  const filteredRooms = rooms
    .filter((r) => r.participantName.includes(search) && (tab === 'all' || (tradeStatusOf(r) === 'IN_PROGRESS' ? 'received' : 'done') === tab))
    .sort((a, b) => Number(tradeStatusOf(a) !== 'IN_PROGRESS') - Number(tradeStatusOf(b) !== 'IN_PROGRESS'))

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text size="sm" weight={tab === t.key ? 'bold' : 'semibold'} color={tab === t.key ? colors.zinc800 : colors.zinc400}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={colors.zinc500} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="검색"
            placeholderTextColor={colors.zinc400}
            style={styles.searchInput}
            selectionColor={colors.main}
            cursorColor={colors.main}
          />
        </View>
      </View>

      <FlatList
        data={loaded ? filteredRooms : []}
        keyExtractor={(room) => String(room.roomId)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.main]} tintColor={colors.main} />}
        ListEmptyComponent={
          loaded ? (
            <Text size="sm" color={colors.zinc400} align="center" style={styles.empty}>
              채팅방이 없습니다.
            </Text>
          ) : (
            <View>
              {Array.from({ length: 5 }).map((_, i) => (
                // 실제 방 줄과 같은 위아래 여백을 둬야 불러온 뒤 목록 높이가 바뀌지 않는다
                <View key={i} style={styles.row}>
                  <Skeleton width={48} height={48} radius={24} />
                  <View style={styles.rowTexts}>
                    <Skeleton width={96} height={12} />
                    <Skeleton width={128} height={12} />
                  </View>
                </View>
              ))}
            </View>
          )
        }
        renderItem={({ item: room }) => {
          const isUnread = !!unreadRoomIds[room.roomId]
          const status = tradeStatusOf(room)
          // 안 읽은 방도 내용을 보여준다. 안 읽음은 빨간 점과 굵은 글씨로 이미 구분된다
          const preview = roomPreviewOf(lastMessageOverride[room.roomId] ?? room.lastMessagePreview)
          return (
            <Pressable
              onPress={() => router.push(`/chat/${room.roomId}`)}
              // 웹은 고른 방의 '...' 버튼으로 나갔다. 휴대폰에서는 길게 눌러 나간다
              onLongPress={() => void handleDeleteRoom(room)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View>
                <Avatar uri={room.participantImageUrl} size={48} />
                {isUnread ? <View style={styles.unreadDot} /> : null}
              </View>
              <View style={styles.rowTexts}>
                {/* 거래가 끝나도 대화는 이어지므로 마지막 메시지는 그대로 보여주고, 결과는 이름 옆에 붙인다 */}
                <View style={styles.nameRow}>
                  <Text size="sm" weight="semibold" numberOfLines={1} style={styles.shrink}>
                    {room.participantName}
                  </Text>
                  {status !== 'IN_PROGRESS' ? (
                    <Text size="xs" weight="semibold" color={status === 'COMPLETED' ? colors.emerald700 : colors.red500}>
                      {status === 'COMPLETED' ? '완료된 거래' : '취소된 거래'}
                    </Text>
                  ) : null}
                </View>
                <Text size="xs" weight={isUnread ? 'semibold' : 'regular'} color={isUnread ? colors.zinc700 : colors.zinc400} numberOfLines={1}>
                  {preview}
                </Text>
              </View>
              <Text size="xs" color={colors.zinc400}>
                {room.lastMessageAt ? formatTime(room.lastMessageAt) : ''}
              </Text>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: PAGE_X,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.zinc800,
  },
  searchArea: {
    paddingHorizontal: PAGE_X,
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    fontWeight: '600',
    color: colors.black,
    paddingVertical: 0,
  },
  list: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAGE_X,
    paddingVertical: 12,
  },
  rowPressed: {
    backgroundColor: colors.zinc50,
  },
  rowTexts: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shrink: {
    flexShrink: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red500,
  },
  empty: {
    paddingVertical: 32,
  },
})
