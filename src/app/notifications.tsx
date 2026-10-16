import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import LoginRequired from '@/components/LoginRequired'
import { colors, radius } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore, type AppNotification, type NotificationType } from '@/store/notificationStore'
import { clearAllNotifications, markNotificationRead } from '@/hooks/useNotificationSubscription'
import { formatMonthDayTime } from '@/lib/date'

const TYPE_STYLE: Record<NotificationType, { label: string; color: string; background: string }> = {
  chat: { label: '채팅', color: colors.yellow700, background: colors.yellow100 },
  notice: { label: '공지', color: colors.red600, background: colors.red100 },
  call: { label: '부재중', color: colors.red600, background: colors.red100 },
}

function open(notification: AppNotification) {
  if (notification.link) router.push(notification.link as never)
  else if (notification.type === 'chat' && notification.roomId !== null) router.push(`/chat/${notification.roomId}`)
}

// 웹 헤더의 알림 창. 휴대폰 화면에 떠 있는 작은 창은 목록이 답답해서 앱은 화면 하나로 연다.
// 눌러서 이동해도 알림은 남는다(채팅 알림은 그 방에 들어가면 지워진다). 지우려면 체크 버튼을 누른다(웹과 같다)
export default function Page() {
  const token = useAuthStore((s) => s.accessToken)
  const notifications = useNotificationStore((s) => s.notifications)

  if (!token) {
    return (
      <View style={styles.container}>
        <BackHeader title="알림" />
        <LoginRequired />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BackHeader
        title="알림"
        right={
          notifications.length > 0 ? (
            <Pressable onPress={clearAllNotifications} hitSlop={8} style={styles.clearAll}>
              <Text size="xs" color={colors.zinc400}>
                모두 지우기
              </Text>
            </Pressable>
          ) : null
        }
      />
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text size="sm" color={colors.zinc400} align="center">
            새 알림이 없습니다.
          </Text>
        }
        renderItem={({ item }) => {
          const type = TYPE_STYLE[item.type]
          return (
            <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View style={[styles.badge, { backgroundColor: type.background }]}>
                <Text weight="semibold" color={type.color} style={styles.badgeText}>
                  {type.label}
                </Text>
              </View>
              <View style={styles.body}>
                <View style={styles.head}>
                  <Text size="sm" weight="semibold" numberOfLines={1} style={styles.flex}>
                    {item.senderName}
                  </Text>
                  <Text color={colors.zinc400} style={styles.time}>
                    {formatMonthDayTime(item.createdAt)}
                  </Text>
                </View>
                <Text size="xs" color={colors.zinc500} numberOfLines={2}>
                  {item.message}
                </Text>
              </View>
              <Pressable
                onPress={() => markNotificationRead(item.id)}
                hitSlop={8}
                accessibilityLabel="읽음 처리"
                style={({ pressed }) => [styles.check, pressed && styles.checkPressed]}
              >
                {({ pressed }) => <Ionicons name="checkmark" size={14} color={pressed ? colors.main : colors.zinc400} />}
              </Pressable>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  clearAll: { paddingHorizontal: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: { backgroundColor: colors.zinc50 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontSize: 11, lineHeight: 16 },
  body: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 11, lineHeight: 16 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPressed: { borderColor: colors.main, backgroundColor: colors.mainSoft },
})
