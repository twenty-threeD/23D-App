import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as SecureStore from 'expo-secure-store'
import { throwApiError } from './apiError'
import { apiUrl, jsonHeaders } from './http'

// 서버는 Expo 푸시로 보낸다(토큰 형식 ExponentPushToken[...]). 안드로이드 FCM·iOS APNs 는 Expo 가 대신 다룬다
export const CHANNEL_CHAT = 'default'
export const CHANNEL_CALL = 'call'

// 로그아웃할 때 서버에서 이 기기 토큰을 빼야 해서, 마지막으로 등록한 토큰을 기억해 둔다
const REGISTERED_KEY = 'push.registeredToken'

export type PushData =
  | { type: 'chat'; roomId?: number }
  | { type: 'call'; roomId?: number; callId?: number; callType?: 'VOICE' | 'VIDEO' }

// 안드로이드 13+ 는 채널이 하나라도 있어야 알림 권한 창이 뜬다. 그래서 토큰을 받기 전에 채널부터 만든다
async function ensureChannels() {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_CHAT, {
    name: '채팅',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
  })
  // 전화는 놓치면 안 돼서 가장 높은 중요도로, 진동을 길게 둔다
  await Notifications.setNotificationChannelAsync(CHANNEL_CALL, {
    name: '전화',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 600, 400, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  })
}

// 권한을 받고 Expo 푸시 토큰을 돌려준다. 거부했거나 받을 수 없는 환경이면 null
export async function getExpoPushToken(): Promise<string | null> {
  await ensureChannels()
  const current = await Notifications.getPermissionsAsync()
  const status = current.status === 'granted' ? current.status : (await Notifications.requestPermissionsAsync()).status
  if (status !== 'granted') return null

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return null
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId })
  return data
}

export async function registerPushToken(accessToken: string, pushToken: string) {
  const res = await fetch(apiUrl('/api/push/token'), {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ token: pushToken, platform: Platform.OS === 'ios' ? 'ios' : 'android' }),
  })
  if (!res.ok) await throwApiError(res)
  await SecureStore.setItemAsync(REGISTERED_KEY, pushToken).catch(() => {})
}

// 로그아웃 전에 부른다. 빼먹으면 로그아웃한 기기로 이전 계정의 채팅·전화 알림이 계속 간다
export async function unregisterPushToken(accessToken: string) {
  const pushToken = await SecureStore.getItemAsync(REGISTERED_KEY).catch(() => null)
  if (!pushToken) return
  await fetch(apiUrl('/api/push/token'), {
    method: 'DELETE',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ token: pushToken }),
  }).catch(() => {})
  await SecureStore.deleteItemAsync(REGISTERED_KEY).catch(() => {})
}

export function pushDataOf(notification: Notifications.Notification): PushData | null {
  const data = notification.request.content.data as Partial<PushData> | undefined
  if (data?.type === 'chat' || data?.type === 'call') return data as PushData
  return null
}
