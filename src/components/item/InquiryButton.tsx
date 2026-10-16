import { useState } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { router, usePathname } from 'expo-router'
import Button from '@/components/ui/Button'
import ServicePickerModal from '@/components/item/ServicePickerModal'
import { useAuthStore } from '@/store/authStore'
import { useChatRoomsStore } from '@/store/chatRoomsStore'
import { openChatRoomForPost } from '@/lib/chat'
import { signinHref } from '@/lib/navigation'
import { FALLBACK_PLAN, type PriceCardPlan } from '@/lib/priceCard'
import { useHandleError } from '@/hooks/useHandleError'

interface InquiryButtonProps {
  /** 글 작성자(을). 이 사람과의 채팅방을 연다 */
  username?: string
  postId?: number
  plans?: PriceCardPlan[]
  style?: StyleProp<ViewStyle>
}

// 문의하기: 플랜을 고르면 글 작성자와의 채팅방을 열고 고른 플랜을 넘긴다.
// 가격 카드 안의 버튼과 하단 고정 버튼이 같은 동작이라 한 곳에 둔다
export default function InquiryButton({ username, postId, plans, style }: InquiryButtonProps) {
  const pathname = usePathname()
  const token = useAuthStore((s) => s.accessToken)
  const handleError = useHandleError()
  const [loading, setLoading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const setSelectedService = useChatRoomsStore((s) => s.setSelectedService)

  async function handleSelectService(service: { planName: string; price: string }) {
    if (!token) {
      setShowPicker(false)
      router.push(signinHref(pathname) as never)
      return
    }
    if (!username || !postId) return
    setLoading(true)
    try {
      const res = await openChatRoomForPost(token, username, postId)
      const room = (res as { data?: { roomId?: number; existingRoom?: boolean } }).data
      if (room?.roomId) {
        setSelectedService(room.roomId, service, !room.existingRoom)
        setShowPicker(false)
        router.push(`/chat/${room.roomId}`)
      }
    } catch (e) {
      void handleError(e)
    } finally {
      setLoading(false)
      setShowPicker(false)
    }
  }

  return (
    <>
      <Button onPress={() => setShowPicker(true)} disabled={loading || !username} style={[{ borderRadius: 8, minHeight: 38 }, style]}>
        {loading ? '연결 중...' : '문의하기'}
      </Button>
      {showPicker ? (
        <ServicePickerModal
          plans={plans && plans.length > 0 ? plans : [FALLBACK_PLAN]}
          busy={loading}
          onClose={() => setShowPicker(false)}
          onSelect={(service) => void handleSelectService(service)}
        />
      ) : null}
    </>
  )
}
