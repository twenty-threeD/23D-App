import { useEffect, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import BackHeader from '@/components/BackHeader'
import PdfView from '@/components/PdfView'
import HelpTooltip from '@/components/blockchain/HelpTooltip'
import TossCheckoutModal, { type TossCheckoutFailure, type TossCheckoutRequest, type TossCheckoutSuccess } from '@/components/pay/TossCheckoutModal'
import { colors, PAGE_X } from '@/constants/theme'
import { getPost, type Post } from '@/lib/post'
import { parsePostContent } from '@/lib/priceCard'
import { getContract } from '@/lib/contract'
import { getChatRooms, unwrap } from '@/lib/chat'
import { getMyProfile } from '@/lib/profile'
import { confirmPayment, preparePayment } from '@/lib/payment'
import { calculatePaymentFee } from '@/lib/paymentFee'
import { MIN_AMOUNT_MESSAGE, isAmountRejected, isBelowMinAmount } from '@/lib/amount'
import { ApiError } from '@/lib/apiError'
import { TOSS_CLIENT_KEY } from '@/lib/config'
import { alert } from '@/lib/dialog'
import { formatNumber } from '@/lib/http'
import { signinHref } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'
import { useChatRoomsStore, type ChatRoom } from '@/store/chatRoomsStore'

type Contract = Awaited<ReturnType<typeof getContract>>

function toPositiveInt(value: string | undefined) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// 서버 제약: 6~64자
function createOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).slice(2, 10)
  return `order-${date}-${random}`
}

// 서버 제약: 100자 이하
function buildOrderName(title?: string | null) {
  return `잇다: ${title || '잇다 서비스 결제'}`.slice(0, 100)
}

// 서버는 LocalDateTime 을 주지만 화면에는 날짜만 필요하다
function formatDate(value: string | null | undefined) {
  if (!value) return ''
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

// 사용자가 결제창을 닫았을 때 토스가 주는 코드. 실패가 아니라 취소로 안내한다
const CANCEL_CODES = new Set(['PAY_PROCESS_CANCELED', 'USER_CANCEL'])

function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Ionicons name="alert-circle-outline" size={13} color={colors.inkHint} />
      <Text size="xs" weight="medium" color={colors.inkHint} style={styles.flex}>
        {children}
      </Text>
    </View>
  )
}

// 웹 /pay/[[...id]](계약서 확인 → 결제). 웹의 /pay/success·/pay/fail 은 따로 두지 않고,
// 결제창 웹뷰에서 돌아오는 결과를 이 화면이 받아 승인까지 마친다
export default function Page() {
  const params = useLocalSearchParams<{ id?: string; contractId?: string; roomId?: string; plan?: string }>()
  const { height: windowHeight } = useWindowDimensions()
  const hydrated = useAuthStore((s) => s.hydrated)
  const hasToken = useAuthStore((s) => !!s.accessToken)
  const username = useAuthStore((s) => s.username)

  const postId = toPositiveInt(params.id)
  const contractId = toPositiveInt(params.contractId)
  // 결제 승인 후 이 방으로 돌아가 결제 완료 메시지를 보낸다
  const roomId = toPositiveInt(params.roomId)
  // 문의 시작 때 고른 플랜. 결제 화면에서는 선택이 끝났으므로 이 플랜만 맞는지 본다
  const selectedPlanName = params.plan || null

  const [verified, setVerified] = useState<{ post: Post; contract: Contract } | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [checkout, setCheckout] = useState<TossCheckoutRequest | null>(null)
  const [confirming, setConfirming] = useState(false)

  // 결제 화면은 채팅방에서 쌓여 열린다. 끝나면 새로 쌓지 않고 그 방으로 돌아간다
  function leave() {
    if (router.canGoBack()) router.back()
    else router.replace(roomId ? `/chat/${roomId}` : '/chat')
  }

  // 주소의 postId·contractId·roomId·plan 은 누구나 고쳐 넣을 수 있다.
  // 서버 prepare 도 계약 금액을 검증하지만 그건 결제하기를 눌러야 드러나므로,
  // 들어올 때 서로가 한 건으로 맞물리는지 확인하고 하나라도 어긋나면 화면을 보여주지 않고 돌려보낸다(웹과 같다)
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false

    const reject = (message: string) => {
      if (cancelled) return
      toast.error(message)
      if (router.canGoBack()) router.back()
      else router.replace(roomId ? `/chat/${roomId}` : '/chat')
    }

    const token = useAuthStore.getState().accessToken
    if (!token) {
      // 로그인 뒤 같은 결제로 돌아오도록 계약·방 정보까지 함께 기억시킨다
      const query = new URLSearchParams({
        ...(contractId ? { contractId: String(contractId) } : {}),
        ...(roomId ? { roomId: String(roomId) } : {}),
        ...(selectedPlanName ? { plan: selectedPlanName } : {}),
      }).toString()
      router.replace(signinHref(`/pay/${postId ?? ''}${query ? `?${query}` : ''}`) as never)
      return
    }
    // 계약 체결 없이(값 없이) 들어오는 경로 자체를 막는다
    if (!postId || !contractId || !roomId) {
      reject('잘못된 결제 경로입니다. 채팅방에서 계약을 체결한 뒤 결제해주세요.')
      return
    }

    Promise.all([getPost(postId, token), getContract(token, contractId), getChatRooms(token), getMyProfile(token)])
      .then(([postRes, contractData, roomsJson, profileRes]) => {
        if (cancelled) return
        const targetPost: Post | null = postRes.data ?? null
        const rooms = unwrap<ChatRoom[]>(roomsJson) ?? []
        const room = Array.isArray(rooms) ? rooms.find((r) => r.roomId === roomId) : undefined
        const myMemberId = profileRes.data?.memberId
        const myUsername = profileRes.data?.username
        const seller = targetPost?.member?.username

        const plans = targetPost ? parsePostContent(targetPost.content).plans : []
        const planMatches = !selectedPlanName || plans.some((p) => p.planName === selectedPlanName)

        const valid =
          targetPost !== null &&
          room !== undefined &&
          // 방이 이 게시글에서 시작된 것이어야 한다
          room.postId === postId &&
          // 갑/을은 방마다 정해진다: 글 작성자가 을, 나는 갑이어야 결제할 수 있다
          !!seller &&
          seller !== myUsername &&
          seller === room.participantUsername &&
          // 계약서 당사자가 정확히 이 방의 나(갑)와 상대(을)여야 한다
          !!myMemberId &&
          contractData.clientId === myMemberId &&
          !!room.participantId &&
          contractData.professionalId === room.participantId &&
          planMatches

        if (!valid || !targetPost) {
          reject('결제 정보가 일치하지 않습니다. 채팅방의 결제하기 버튼으로 다시 시도해주세요.')
          return
        }
        setVerified({ post: targetPost, contract: contractData })
      })
      .catch(() => {
        // 남의 계약서·없는 게시글 등은 서버가 403/404 로 거절한다
        reject('결제 정보를 확인할 수 없습니다. 채팅방의 결제하기 버튼으로 다시 시도해주세요.')
      })

    return () => {
      cancelled = true
    }
  }, [hydrated, hasToken, postId, contractId, roomId, selectedPlanName])

  // 확인을 통과하기 전에는 아무것도 그리지 않는다 (금액·버튼이 잠깐이라도 보이지 않게)
  if (!verified || !contractId || !roomId) {
    return (
      <View style={styles.container}>
        <BackHeader title="계약서 확인" />
        <Text color={colors.zinc400} align="center" style={styles.message}>
          결제 정보를 확인하는 중...
        </Text>
      </View>
    )
  }

  const { post, contract } = verified
  // 수수료 구간과 비율은 안내용이며, 최종 금액·수수료·정산액은 서버 prepare 응답과 대조한다
  const price = contract.price
  const paymentFee = calculatePaymentFee(price)
  // 계약 금액이 서버의 최소 결제 금액보다 작으면 결제창을 열지 않는다
  const amountTooLow = isBelowMinAmount(price)

  // 아래 항목은 계약서 PDF 의 내용을 서버에 저장된 값으로 다시 보여주는 것이다.
  // PDF 는 앱·웹이 그려 올린 파일이라, 둘이 다르면 사용자가 알아채고 신고할 수 있게 나란히 둔다
  const fields: { label: string; value: string; suffix?: string }[] = [
    { label: '갑', value: contract.clientName },
    { label: '을', value: contract.professionalName },
    { label: '용역 시작일', value: formatDate(contract.startedAt) },
    { label: '용역 종료일', value: formatDate(contract.endedAt) },
    { label: '검수기간', value: String(contract.inspectionPeriod ?? ''), suffix: '일' },
    { label: '계약서 작성일', value: formatDate(contract.createdAt) },
  ]

  async function handlePay() {
    if (amountTooLow || preparing || !roomId || !contractId) return
    if (!TOSS_CLIENT_KEY) {
      void alert('결제 키가 설정되지 않았습니다.')
      return
    }
    const token = useAuthStore.getState().accessToken
    if (!token) {
      void alert('로그인이 필요합니다.')
      return
    }
    if (!contract.contractUrl) {
      void alert('계약서 정보를 찾을 수 없습니다. 채팅방의 결제하기 버튼으로 다시 시도해주세요.')
      return
    }

    const orderName = buildOrderName(post.title)
    const prepareBody = { amount: price, contractUrl: contract.contractUrl, orderName, roomId, contractId }
    setPreparing(true)
    try {
      // 결제창에 넘길 orderId 를 먼저 정하고 서버에 등록한다.
      // 서버에 저장된 금액을 결제창과 승인 요청까지 그대로 유지해야 금액 검증을 통과한다
      let orderId = createOrderId()
      let prepared: Awaited<ReturnType<typeof preparePayment>>
      try {
        prepared = await preparePayment(token, { orderId, ...prepareBody })
      } catch (e) {
        // 주문번호가 겹친 경우에 한해 새 번호로 한 번만 다시 시도한다
        if (!(e instanceof ApiError && e.code === 'PAYMENT_ORDER_ID_DUPLICATED')) throw e
        orderId = createOrderId()
        prepared = await preparePayment(token, { orderId, ...prepareBody })
      }

      if (
        prepared.orderId !== orderId ||
        prepared.amount !== price ||
        prepared.feeAmount !== paymentFee.fee ||
        prepared.settlementAmount !== paymentFee.settlement
      ) {
        throw new Error('서버 수수료 정보와 결제 화면이 일치하지 않습니다. 화면을 닫았다가 다시 시도해주세요.')
      }

      setCheckout({ clientKey: TOSS_CLIENT_KEY, orderId, orderName, amount: prepared.amount, customerName: username || '익명의 고객' })
    } catch (error) {
      // 사전 등록에 실패하면 결제창을 띄우지 않고 멈춘다
      void alert(
        isAmountRejected(error, 'amount')
          ? MIN_AMOUNT_MESSAGE
          : error instanceof Error
            ? error.message
            : '결제 요청 중 오류가 발생했습니다. 다시 시도해주세요.',
      )
    } finally {
      setPreparing(false)
    }
  }

  async function handleCheckoutSuccess(result: TossCheckoutSuccess) {
    setCheckout(null)
    if (!roomId) return
    setConfirming(true)
    try {
      const token = useAuthStore.getState().accessToken
      if (!token) throw new Error('로그인이 필요합니다.')
      const res = await confirmPayment(token, result)
      toast.success('결제가 완료되었습니다.')

      // 서버가 승인과 함께 이 방을 거래 완료로 바꿔둔다. 방 목록을 다시 받기 전에도 채팅방에 바로 보이도록 맞춰둔다
      useChatRoomsStore.getState().setRoomTradeStatus(roomId, 'COMPLETED')
      // 백엔드는 승인 결과를 응답으로만 주고 채팅 메시지를 만들지 않는다. 계약서와 같은 방식으로 앱이 채팅에 알린다 —
      // 대기열에 넣어두면 채팅방이 연결된 상태에서 바로 보낸다
      const paid = res?.data?.payment
      useChatRoomsStore.getState().setPendingPayment(roomId, {
        orderId: paid?.orderId ?? result.orderId,
        orderName: paid?.orderName ?? '',
        amount: Number(paid?.totalAmount ?? result.amount),
        txHash: res?.data?.blockchainTxHash ?? null,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '결제 승인에 실패했습니다.')
    } finally {
      setConfirming(false)
      // 승인 결과와 상관없이 대화 맥락에서 결과를 확인하도록 채팅방으로 돌아간다(웹과 같다)
      leave()
    }
  }

  function handleCheckoutFail(failure: TossCheckoutFailure) {
    setCheckout(null)
    if (failure.code && CANCEL_CODES.has(failure.code)) {
      toast.info('결제를 취소했어요.')
      return
    }
    void alert(failure.message || '결제가 취소되었거나 오류가 발생했습니다.', '결제에 실패했습니다')
  }

  return (
    <View style={styles.container}>
      <BackHeader title="계약서 확인" />
      <ScrollView contentContainerStyle={styles.content}>
        <PdfView url={contract.contractUrl} height={Math.round(windowHeight * 0.7)} />

        <View style={styles.body}>
          <View style={styles.fieldGroup}>
            <View style={styles.fields}>
              {fields.map((field) => (
                <View key={field.label} style={styles.field}>
                  <Text size="lg" weight="semibold" color={colors.ink}>
                    {field.label}
                  </Text>
                  <View style={styles.fieldBox}>
                    <Text size="xs" weight="medium" color={colors.inkHint}>
                      {field.value || '-'}
                    </Text>
                    {field.suffix ? (
                      <Text size="xs" weight="medium" color={colors.inkHint}>
                        {field.suffix}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            <Notice>위 표시되는 내용과 계약서의 내용이 다른 경우 고객센터로 신고 바랍니다.</Notice>
          </View>

          <View style={styles.payGroup}>
            <View style={styles.amount}>
              <Text size="sm" weight="medium" color={colors.inkHint}>
                최종 결제 금액
              </Text>
              <Text size="3xl" weight="semibold" color={colors.ink}>
                {formatNumber(price)}원
              </Text>
            </View>
            <Button size="lg" loading={preparing} disabled={amountTooLow} onPress={() => void handlePay()}>
              결제하기
            </Button>
            {amountTooLow ? (
              <Text size="xs" color={colors.red500}>
                {MIN_AMOUNT_MESSAGE}
              </Text>
            ) : null}
            <View style={styles.notice}>
              <HelpTooltip title="플랫폼 수수료" marker={<Ionicons name="alert-circle-outline" size={13} color={colors.inkHint} />}>
                계약 금액의 {paymentFee.rate}% ({formatNumber(paymentFee.fee)}원)가 수수료로 차감되어 을에게 {formatNumber(paymentFee.settlement)}원이
                정산됩니다.
              </HelpTooltip>
              <Text size="xs" weight="medium" color={colors.inkHint} style={styles.flex}>
                수수료는 을의 정산액에서 차감됩니다.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {checkout ? (
        <TossCheckoutModal
          request={checkout}
          onSuccess={(result) => void handleCheckoutSuccess(result)}
          onFail={handleCheckoutFail}
          onClose={() => setCheckout(null)}
        />
      ) : null}

      {confirming ? (
        <View style={styles.confirming}>
          <Text color={colors.zinc400}>결제 처리 중...</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  message: { paddingVertical: 80 },
  content: { paddingBottom: 48 },
  body: { gap: 56, paddingHorizontal: PAGE_X, paddingTop: 32 },
  fieldGroup: { gap: 16 },
  fields: { gap: 24 },
  field: { gap: 14 },
  fieldBox: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
  },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payGroup: { gap: 12 },
  amount: { gap: 8, paddingBottom: 4 },
  confirming: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
})
