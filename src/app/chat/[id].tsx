import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import * as Clipboard from 'expo-clipboard'
import { File } from 'expo-file-system'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Client } from '@stomp/stompjs'
import Text from '@/components/ui/Text'
import { toast } from '@/components/ui/Toast'
import { Avatar } from '@/components/PostImage'
import ImageLightbox from '@/components/ImageLightbox'
import LoginRequired from '@/components/LoginRequired'
import ChatStartCard from '@/components/chat/ChatStartCard'
import ContractCard from '@/components/chat/ContractCard'
import PaymentCard from '@/components/chat/PaymentCard'
import DealCard from '@/components/chat/DealCard'
import CallLogCard from '@/components/chat/CallLogCard'
import ContractWizardModal from '@/components/chat/ContractWizardModal'
import ContractViewerModal from '@/components/chat/ContractViewerModal'
import { colors, FONT_FAMILY, radius } from '@/constants/theme'
import { useAuthStore, decodeJwtUsername } from '@/store/authStore'
import { useChatRoomsStore, type ChatRoom, type TradeStatus } from '@/store/chatRoomsStore'
import {
  cancelTrade,
  deleteChatRoom,
  getChatRooms,
  loadCachedChatMessages,
  loadOlderChatMessages,
  mergeMessages,
  syncChatMessages,
  unwrap,
} from '@/lib/chat'
import { cacheMessages } from '@/lib/chatDb'
import { createStompClient, sendChatMessage } from '@/lib/stomp'
import { fileNameFromUrl, isImageUrl, toAbsoluteUrl, uploadFile, type LocalFile } from '@/lib/file'
import { HeifConversionError } from '@/lib/imageCompress'
import { getMyProfile } from '@/lib/profile'
import { getPost, getPostMainImage, type Post } from '@/lib/post'
import { parseChatStart } from '@/lib/chatPreview'
import { parseCallLog } from '@/lib/callLog'
import { formatDealCancel, parseDealEnd, parseDealRequest } from '@/lib/deal'
import { parseContractMessage, parsePaymentMessage, type CompletedContract, type ContractData, type Message } from '@/lib/chatMessages'
import { createContract, toContractDateTime } from '@/lib/contract'
import { saveSignaturePng } from '@/lib/contractPdf'
import { MIN_AMOUNT_MESSAGE, isAmountRejected } from '@/lib/amount'
import { dateKey, formatDateWithWeekday, formatTime } from '@/lib/date'
import { pickImages, pickPdf } from '@/lib/pickers'
import { confirm } from '@/lib/dialog'
import { ApiError, isPayloadTooLarge } from '@/lib/apiError'
import { useHandleError } from '@/hooks/useHandleError'

const MAX_CHAT_FILE_SIZE = 25 * 1024 * 1024

// 계약서 PDF·서명처럼 앱이 만들어 올린 임시 파일은 올린 뒤 지운다. 계약마다 1MB 가까이 캐시에 쌓이지 않게 한다
function discardLocalFile(uri: string) {
  try {
    new File(uri).delete()
  } catch {
    // 이미 지워졌거나 지울 수 없어도 업로드는 끝났다
  }
}

interface PendingImage {
  // 미리보기와 업로드 결과를 한 항목으로 묶는다. 배열 두 개로 따로 들면 일부만 실패하거나
  // 업로드 중에 하나를 지울 때 순서가 어긋나 엉뚱한 사진이 보내지거나 지워졌다(웹과 같은 이유)
  key: string
  preview: string
  url: string | null
}

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const roomId = Number(id) || null
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const bubbleMaxWidth = Math.min(320, width * 0.62)

  const token = useAuthStore((s) => s.accessToken)
  const hasToken = !!token
  const myUsername = useAuthStore((s) => s.username ?? (s.accessToken ? decodeJwtUsername(s.accessToken) : null))
  const rooms = useChatRoomsStore((s) => s.rooms)
  const markRoomRead = useChatRoomsStore((s) => s.markRoomRead)
  const setActiveRoomId = useChatRoomsStore((s) => s.setActiveRoomId)
  const clearPendingGreeting = useChatRoomsStore((s) => s.clearPendingGreeting)
  const clearPendingPayment = useChatRoomsStore((s) => s.clearPendingPayment)
  const handleError = useHandleError()
  // useHandleError 는 경로가 바뀌면 새 함수를 돌려줘서 동기화 의존성에 넣으면 반복된다. 최신 값만 ref 로 읽는다
  const handleErrorRef = useRef(handleError)
  useEffect(() => {
    handleErrorRef.current = handleError
  })

  const selectedRoom = rooms.find((r) => r.roomId === roomId)
  // post 를 올린 사람이 을(파는 사람), 문의하기를 눌러 들어온 사람이 갑(사는 사람)이다.
  // 계정 role 이 아니라 방마다 정해지므로 글 작성자를 조회해서 판단한다. 채팅 시작 카드에도 제목·썸네일이 필요해 글을 통째로 든다
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const postAuthorUsername = selectedPost?.member?.username ?? null
  // 글 작성자를 아직 못 불러왔으면 null (판별 전에는 계약서·결제 버튼을 띄우지 않는다)
  const myPartyRole: 'client' | 'professional' | null =
    postAuthorUsername && myUsername ? (postAuthorUsername === myUsername ? 'professional' : 'client') : null

  const [messages, setMessages] = useState<Message[]>([])
  // 어느 방의 메시지를 불러오는 중인지. 방이 바뀌면 자동으로 다시 불러오는 중이 된다
  const [loadedRoomId, setLoadedRoomId] = useState<number | null>(null)
  const loadingMessages = loadedRoomId !== roomId
  const [hasOlder, setHasOlder] = useState(true)
  const loadingOlderRef = useRef(false)
  const [message, setMessage] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const uploadedImageUrls = pendingImages.flatMap((img) => (img.url ? [img.url] : []))
  const [pendingDoc, setPendingDoc] = useState<{ name: string; url: string | null } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  // 방금 복사한 트랜잭션 해시. 해시 줄에 잠깐 "복사됐어요"를 띄우는 데만 쓴다
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [dealBusy, setDealBusy] = useState(false)
  const [contractModal, setContractModal] = useState<{ mode: 'propose' | 'review'; initial: Partial<ContractData> } | null>(null)
  const [contractBusy, setContractBusy] = useState(false)
  // 전화번호 인증 여부(서명 가능 조건)와 내 회원 ID(계약서 등록에 필요)
  const [phoneVerified, setPhoneVerified] = useState<boolean | undefined>(undefined)
  const [myMemberId, setMyMemberId] = useState<number | undefined>(undefined)
  const [viewingContractUrl, setViewingContractUrl] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const stompClientRef = useRef<Client | null>(null)
  // 소켓 재연결 콜백은 연결 시점의 클로저라 최신 목록을 ref 로 읽는다
  const messagesRef = useRef<Message[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  // 방을 빠르게 바꾸면 이전 방 응답이 늦게 도착해 섞이므로 현재 방인지 확인한다
  const currentRoomRef = useRef<number | null>(null)

  // 이 방을 보는 동안은 알림·안읽음 표시를 쌓지 않는다
  useFocusEffect(
    useCallback(() => {
      setActiveRoomId(roomId)
      if (roomId) markRoomRead(roomId)
      return () => setActiveRoomId(null)
    }, [roomId, setActiveRoomId, markRoomRead]),
  )

  // 알림·딥링크로 바로 들어오면 방 목록이 비어 있다. 방 정보(상대·글·거래 상태)가 있어야 화면을 그릴 수 있어 받아 둔다
  useEffect(() => {
    if (!token || useChatRoomsStore.getState().rooms.some((r) => r.roomId === roomId)) return
    getChatRooms(token)
      .then((res) => useChatRoomsStore.getState().setRooms(unwrap<ChatRoom[]>(res) ?? []))
      .catch(() => {})
  }, [token, roomId])

  // 실시간 연결. 토큰은 만료 전에 재발급되는데, effect 가 토큰 값에 의존하면 재발급마다 소켓이 끊겼다 붙어서
  // 연결은 로그인 여부로만 유지하고 실제 토큰은 접속·발송 때마다 스토어에서 꺼낸다(stomp.ts)
  useEffect(() => {
    if (!roomId || !hasToken) return
    // 첫 연결은 아래 메시지 불러오기가 동기화하므로, 재연결일 때만 끊긴 구간을 after 로 메운다
    let connectedOnce = false

    const client = createStompClient({
      onConnect: (stomp) => {
        setConnected(true)
        stomp.subscribe(`/topic/chat/rooms/${roomId}`, (frame) => {
          try {
            const msg: Message = JSON.parse(frame.body)
            setMessages((prev) => mergeMessages(prev, [msg]))
            // 서버는 거래 상태가 바뀌어도 따로 알려주지 않는다. 상태를 바꾸는 일과 같이 오는 메시지를 보고 맞춘다.
            const nextStatus: TradeStatus | null =
              msg.type === 'PAYMENT'
                ? 'COMPLETED'
                : msg.message?.startsWith('[계약서 체결 완료]')
                  ? 'IN_PROGRESS'
                  : parseDealEnd(msg.message ?? '')?.kind === 'canceled'
                    ? 'CANCELED'
                    : null
            if (nextStatus) useChatRoomsStore.getState().setRoomTradeStatus(roomId, nextStatus)
            // 보고 있는 방은 알림이 오지 않아, 주고받은 메시지를 여기서 목록 미리보기에 반영한다
            useChatRoomsStore
              .getState()
              .applyLastMessage(roomId, msg.message || (msg.attachedFileUrls?.length ? '파일을 보냈습니다.' : ''), msg.createdAt)
            // 다음 진입 때 네트워크 없이 바로 그리기 위한 렌더 캐시
            void cacheMessages([msg]).catch(() => {})
            markRoomRead(roomId)
          } catch {
            // 형식이 맞지 않는 프레임은 무시한다
          }
        })

        if (connectedOnce) {
          const current = useAuthStore.getState().accessToken
          if (current) {
            void syncChatMessages(current, roomId, messagesRef.current as never)
              .then((list) => {
                if (currentRoomRef.current !== roomId) return
                setMessages((cur) => mergeMessages(cur, list as unknown as Message[]))
              })
              .catch(() => {})
          }
        }
        connectedOnce = true

        // 문의하기에서 새로 만들어진 방이면 연결 직후 인사말을 한 번 보낸다. 안내 카드로 그려야 해서 구조화된 내용을 싣는다
        if (useChatRoomsStore.getState().pendingGreeting[roomId]) {
          const service = useChatRoomsStore.getState().selectedService[roomId]
          const greeting = `[채팅 시작]\n${JSON.stringify({
            starter: myUsername ?? '',
            planName: service?.planName ?? '기타',
            price: service?.price ?? '',
          })}`
          sendChatMessage(stomp, roomId, greeting)
          clearPendingGreeting(roomId)
        }
      },
      onWebSocketClose: () => setConnected(false),
    })

    client.activate()
    stompClientRef.current = client
    return () => {
      void client.deactivate()
      stompClientRef.current = null
      setConnected(false)
    }
  }, [roomId, hasToken, myUsername, clearPendingGreeting, markRoomRead])

  // 결제 승인 후 아직 못 보낸 결제 완료 알림을 보낸다(웹과 같은 접두사 규약).
  // 결제 화면은 이 방 위에 쌓였다가 닫히므로 방이 이미 연결된 채로 돌아오는 일이 많다.
  // 연결될 때만 보내면 그 경우를 놓쳐서, 연결 상태와 대기열 둘 중 하나가 바뀔 때마다 확인한다
  const pendingPaid = useChatRoomsStore((s) => (roomId ? s.pendingPayment[roomId] : undefined))
  useEffect(() => {
    const client = stompClientRef.current
    if (!roomId || !pendingPaid || !connected || !client?.connected) return
    sendChatMessage(client, roomId, `[결제 완료]\n${JSON.stringify(pendingPaid)}`)
    clearPendingPayment(roomId)
  }, [roomId, pendingPaid, connected, clearPendingPayment])

  // 캐시를 먼저 그려 네트워크를 기다리지 않게 하고, 서버에서 그 이후분만 받아 합친다
  useEffect(() => {
    const current = useAuthStore.getState().accessToken
    if (!current || !roomId) return
    currentRoomRef.current = roomId
    let cancelled = false
    ;(async () => {
      try {
        const clearBefore = useChatRoomsStore.getState().rooms.find((r) => r.roomId === roomId)?.clearBefore ?? null
        const cached = await loadCachedChatMessages(roomId, clearBefore)
        if (cancelled) return
        setHasOlder(true)
        setMessages(cached as unknown as Message[])
        if (cached.length > 0) setLoadedRoomId(roomId)
        const fresh = await syncChatMessages(current, roomId, cached)
        if (cancelled) return
        setMessages((prev) => mergeMessages(prev, fresh as unknown as Message[]))
      } catch (e) {
        if (!cancelled) void handleErrorRef.current(e)
      } finally {
        if (!cancelled) setLoadedRoomId(roomId)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasToken, roomId])

  const loadOlder = useCallback(async () => {
    const current = useAuthStore.getState().accessToken
    if (!current || !roomId || !hasOlder || loadingOlderRef.current) return
    const oldest = messagesRef.current.find((m) => m.messageId != null)?.messageId
    if (oldest == null) return
    loadingOlderRef.current = true
    try {
      const page = await loadOlderChatMessages(current, roomId, oldest)
      if (currentRoomRef.current !== roomId) return
      if (page.length === 0) {
        setHasOlder(false)
        return
      }
      setMessages((prev) => mergeMessages(prev, page as unknown as Message[]))
    } catch (e) {
      void handleErrorRef.current(e)
    } finally {
      loadingOlderRef.current = false
    }
  }, [roomId, hasOlder])

  // 이 방의 을(파는 사람)이 누구인지 = 그 글을 쓴 사람이 누구인지 조회한다
  const selectedPostId = selectedRoom?.postId
  useEffect(() => {
    if (!selectedPostId) return
    let cancelled = false
    getPost(selectedPostId, token)
      .then((res) => {
        if (!cancelled) setSelectedPost(res.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setSelectedPost(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPostId, token])

  // 전화번호 인증 여부(서명 가능 조건)와 내 회원 ID(계약서 등록에 필요)를 함께 받아 둔다. 프로필은 캐시되어 비용이 거의 없다
  useEffect(() => {
    const current = useAuthStore.getState().accessToken
    if (!current) return
    let cancelled = false
    getMyProfile(current)
      .then((res) => {
        if (cancelled) return
        setPhoneVerified(res.data?.phoneVerified ?? false)
        setMyMemberId(res.data?.memberId)
      })
      .catch(() => {
        if (!cancelled) setPhoneVerified(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasToken])

  const tradeStatus: TradeStatus = selectedRoom?.tradeStatus ?? 'IN_PROGRESS'

  async function handleDeleteRoom() {
    if (!token || !roomId) return
    if (!(await confirm('채팅방을 삭제하시겠습니까?', { confirmText: '삭제', destructive: true }))) return
    try {
      await deleteChatRoom(token, roomId)
      const store = useChatRoomsStore.getState()
      store.setRooms(store.rooms.filter((r) => r.roomId !== roomId))
      router.back()
    } catch (e) {
      void handleError(e)
    }
  }

  // 상태는 서버에서 바꾸고, 상대도 알 수 있게 대화에 취소 카드를 남긴다
  async function handleCancelTrade() {
    const client = stompClientRef.current
    if (!token || !client?.connected || !roomId || !myUsername || dealBusy) return
    if (!(await confirm('거래를 취소할까요?', { confirmText: '거래 취소', destructive: true }))) return
    setDealBusy(true)
    try {
      await cancelTrade(token, roomId)
      useChatRoomsStore.getState().setRoomTradeStatus(roomId, 'CANCELED')
      sendChatMessage(client, roomId, formatDealCancel(myUsername))
      setShowAttach(false)
    } catch (e) {
      // 상대가 먼저 결제했거나 취소해서 이미 끝난 거래다. 화면이 늦게 반영된 경우라 목록을 다시 받아 맞춘다
      if (e instanceof ApiError && e.code === 'TRADE_NOT_CANCELABLE') {
        toast.error('이미 끝난 거래라 취소할 수 없어요. 결제된 거래는 결제 취소로 되돌려주세요.')
        getChatRooms(token)
          .then((res) => useChatRoomsStore.getState().setRooms(unwrap<ChatRoom[]>(res) ?? []))
          .catch(() => {})
        return
      }
      void handleError(e)
    } finally {
      setDealBusy(false)
    }
  }

  async function handlePickImages() {
    setShowAttach(false)
    if (!token) return
    const picked = await pickImages({ multiple: true })
    const files = picked.filter((file) => {
      if (file.size != null && file.size > MAX_CHAT_FILE_SIZE) {
        toast.error(`${file.name}: 사진은 최대 25MB까지 업로드할 수 있어요.`)
        return false
      }
      return true
    })
    if (files.length === 0) return
    const added = files.map((file, i) => ({ file, key: `${Date.now()}-${i}-${file.uri}` }))
    setPendingImages((prev) => [...prev, ...added.map(({ file, key }) => ({ key, preview: file.uri, url: null }))])
    setUploading(true)
    let failed = 0
    let failedHeif = 0
    try {
      for (const { file, key } of added) {
        try {
          const { url } = await uploadFile(token, file)
          setPendingImages((prev) => prev.map((img) => (img.key === key ? { ...img, url } : img)))
        } catch (error) {
          // 실패한 사진만 빼고 나머지는 그대로 보낼 수 있게 둔다
          failed++
          if (error instanceof HeifConversionError) failedHeif++
          setPendingImages((prev) => prev.filter((img) => img.key !== key))
        }
      }
      if (failed > 0) {
        toast.error(
          failedHeif > 0
            ? `HEIF 사진 ${failedHeif}장을 변환하지 못했어요. JPG, PNG 또는 WEBP로 저장한 뒤 다시 선택해주세요. (전체 실패 ${failed}장)`
            : `사진 ${failed}장을 올리지 못했어요.`,
        )
      }
    } finally {
      setUploading(false)
    }
  }

  async function handlePickDocument() {
    setShowAttach(false)
    if (!token) return
    const file: LocalFile | null = await pickPdf()
    if (!file) return
    setPendingDoc({ name: file.name, url: null })
    setUploading(true)
    try {
      const { url } = await uploadFile(token, file)
      setPendingDoc({ name: file.name, url })
    } catch (e) {
      setPendingDoc(null)
      // 실패해도 첨부 표시만 사라져서 사용자는 왜 안 붙는지 알 수 없었다
      toast.error(isPayloadTooLarge(e) ? `${file.name}: 파일이 너무 커요.` : `${file.name}: 문서를 올리지 못했어요. PDF 파일만 보낼 수 있어요.`)
    } finally {
      setUploading(false)
    }
  }

  function handleSend() {
    if (!roomId) return
    if (!message.trim() && uploadedImageUrls.length === 0 && !pendingDoc?.url) return
    const client = stompClientRef.current
    if (!client?.connected) {
      toast.error('연결 중이에요. 잠시 후 다시 보내주세요.')
      return
    }
    if (uploading) return
    // 사진과 문서를 함께 첨부했으면 같이 보낸다
    const fileUrls = [...uploadedImageUrls, ...(pendingDoc?.url ? [pendingDoc.url] : [])]
    sendChatMessage(client, roomId, message.trim(), fileUrls)
    setMessage('')
    setPendingImages([])
    setPendingDoc(null)
  }

  // 계약서 진행 순서: 을(글 올린 사람, 파는 쪽)이 [계약서 제안](propose) → 갑(문의한 사람, 사는 쪽)이
  // 검토 후 서명하면 그 자리에서 양쪽 서명이 담긴 PDF 를 만들어 서버에 등록([계약서 체결 완료], review) → 갑이 결제.
  // 서명은 PDF 안에 그림으로 이미 들어가므로 서버에 따로 서명하는 단계는 없다(웹과 같다).
  //
  // 갑·을은 등록하는 사람이 아니라 게시글 작성자로 정한다. 작성자가 을(professionalId)이고 채팅의 다른 쪽이 갑(clientId)이다.
  // 서버가 게시글 작성자와 professionalId 가 같은지 검사하고, postId 를 빼면 계약이 게시글에 묶이지 않아 리뷰를 쓸 수 없다
  async function handleContractSubmit(data: ContractData, pdf?: LocalFile) {
    const current = useAuthStore.getState().accessToken
    const client = stompClientRef.current
    if (!current || !roomId || !contractModal || !selectedRoom) return
    if (!client?.connected) {
      toast.error('연결 중이에요. 잠시 후 다시 시도해주세요.')
      return
    }

    setContractBusy(true)
    try {
      if (contractModal.mode === 'review') {
        if (!pdf) return
        const postId = selectedRoom.postId ?? null
        let clientId: number | null | undefined = myMemberId
        let professionalId: number | null | undefined = selectedRoom.participantId
        if (postId) {
          // 방에 들어올 때 이미 받아 둔 글이 있으면 다시 조회하지 않는다
          const authorId = selectedPost?.id === postId ? selectedPost.member?.id : (await getPost(postId, current)).data?.member?.id
          professionalId = authorId
          clientId = authorId != null && authorId === myMemberId ? selectedRoom.participantId : myMemberId
        }
        if (!clientId || !professionalId) {
          toast.error('계약 당사자 정보를 확인하지 못했습니다.')
          return
        }

        const { url: contractUrl } = await uploadFile(current, pdf)
        discardLocalFile(pdf.uri)
        const contract = await createContract(current, {
          contractUrl,
          clientId,
          professionalId,
          postId,
          startedAt: toContractDateTime(data.startDate),
          endedAt: toContractDateTime(data.endDate, true),
          inspectionPeriod: data.inspectionDays,
          price: data.price,
          servicesDescription: data.serviceContent,
        })

        // 결제에 필요한 값(금액·PDF 경로)을 메시지에 같이 싣는다
        const completed: CompletedContract = { contractId: contract.id, price: data.price, contractUrl }
        sendChatMessage(client, roomId, `[계약서 체결 완료]\n${JSON.stringify(completed)}`, [contractUrl])
        setContractModal(null)
        return
      }

      const myNewSig = myPartyRole === 'client' ? data.clientSig : data.professionalSig
      let myUploadedSig = myNewSig
      if (myNewSig.startsWith('data:')) {
        // 서명은 계약서 PDF 를 만들 때 pdf-lib 의 embedPng 로 다시 읽으므로 PNG 를 그대로 올린다
        const signatureFile = saveSignaturePng(myNewSig)
        const { url } = await uploadFile(current, signatureFile, { keepOriginal: true })
        discardLocalFile(signatureFile.uri)
        myUploadedSig = url
      }
      const payload: ContractData = {
        ...data,
        clientSig: myPartyRole === 'client' ? myUploadedSig : data.clientSig,
        professionalSig: myPartyRole === 'professional' ? myUploadedSig : data.professionalSig,
      }
      // 서명 주소는 내용 안에 이미 들어 있다. 첨부로도 보내면 채팅에 서명 이미지가 그대로 보여서 붙이지 않는다
      sendChatMessage(client, roomId, `[계약서 제안]\n${JSON.stringify(payload)}`, [])
      setContractModal(null)
    } catch (e) {
      if (isAmountRejected(e, 'price')) {
        toast.error(MIN_AMOUNT_MESSAGE)
        return
      }
      void handleError(e)
    } finally {
      setContractBusy(false)
    }
  }

  // 계약 체결 후 결제 화면으로 이동한다.
  // 금액은 조작될 수 있어 주소에 싣지 않고, 결제 화면이 contractId 로 서버에서 다시 조회한다
  function handlePayNavigate(completed: CompletedContract) {
    if (!selectedRoom?.postId || !roomId) return
    // 문의를 시작할 때 고른 서비스. 결제 화면에서 그 플랜만 보여주기 위해 넘긴다
    const picked = useChatRoomsStore.getState().selectedService[roomId]
    router.push({
      pathname: '/pay/[id]',
      params: {
        id: String(selectedRoom.postId),
        contractId: String(completed.contractId),
        roomId: String(roomId),
        ...(picked?.planName ? { plan: picked.planName } : {}),
      },
    })
  }

  function openFile(url: string) {
    void Linking.openURL(toAbsoluteUrl(url)).catch(() => toast.error('파일을 열 수 없어요.'))
  }

  function copyHash(txHash: string) {
    void Clipboard.setStringAsync(txHash).then(() => {
      setCopiedHash(txHash)
      setTimeout(() => setCopiedHash((h) => (h === txHash ? null : h)), 1500)
    })
  }

  // 제안 카드는 자기 메시지만 보고 그리므로, 마지막 체결 시점을 미리 구해 그보다 앞선 제안은 끝난 것으로 표시한다.
  // 같은 이유로 체결 카드도 결제 완료를 모르므로, 마지막 결제보다 앞선 체결은 결제된 것으로 본다.
  // 서버 PAYMENT 메시지와 [결제 완료] 메시지가 같은 주문이면 카드가 두 번 보이므로 서버 메시지 쪽만 그린다
  const { lastCompletedIdx, lastPaymentIdx, serverPaidOrderIds } = useMemo(() => {
    let completedIdx = -1
    let paymentIdx = -1
    const paidIds = new Set<string>()
    messages.forEach((m, i) => {
      if (m.message?.startsWith('[계약서 체결 완료]')) completedIdx = i
      if ((m.type === 'PAYMENT' && m.payment) || m.message?.startsWith('[결제 완료]')) paymentIdx = i
      if (m.type === 'PAYMENT' && m.payment?.orderId) paidIds.add(m.payment.orderId)
    })
    return { lastCompletedIdx: completedIdx, lastPaymentIdx: paymentIdx, serverPaidOrderIds: paidIds }
  }, [messages])

  // 최신 메시지가 아래에 붙도록 뒤집힌 목록을 쓴다. 위로 끝까지 올리면 이전 메시지를 이어 받는다
  const reversed = useMemo(() => [...messages].reverse(), [messages])

  function renderMessage(msg: Message, idx: number) {
    if (!selectedRoom) return null
    const prevMsg = messages[idx - 1]
    const nextMsg = messages[idx + 1]
    const showDateDivider = !prevMsg || dateKey(msg.createdAt) !== dateKey(prevMsg.createdAt)
    const showTime =
      !nextMsg ||
      nextMsg.senderUsername !== msg.senderUsername ||
      formatTime(nextMsg.createdAt) !== formatTime(msg.createdAt) ||
      dateKey(nextMsg.createdAt) !== dateKey(msg.createdAt)

    const isSent = msg.senderUsername === myUsername
    const attachedUrls = msg.attachedFileUrls ?? []
    const imageUrls = attachedUrls.filter(isImageUrl)
    const docUrls = attachedUrls.filter((url) => !isImageUrl(url))

    const attachment =
      attachedUrls.length > 0 ? (
        <View style={[styles.attachments, isSent && styles.alignEnd]}>
          {imageUrls.length > 0 ? (
            <View style={[styles.imageGrid, { maxWidth: bubbleMaxWidth }, isSent && styles.justifyEnd]}>
              {imageUrls.map((url) => (
                <Pressable key={url} onPress={() => setLightboxSrc(url)} accessibilityLabel="첨부 이미지 크게 보기">
                  <Image source={{ uri: toAbsoluteUrl(url) }} style={styles.attachedImage} contentFit="cover" cachePolicy="memory-disk" />
                </Pressable>
              ))}
            </View>
          ) : null}
          {docUrls.map((url) => (
            <Pressable key={url} onPress={() => openFile(url)} style={[styles.docChip, { maxWidth: bubbleMaxWidth }]}>
              <MaterialIcons name="description" size={18} color={colors.zinc500} />
              <Text size="xs" color={colors.zinc600} numberOfLines={1} style={styles.shrink}>
                {fileNameFromUrl(url)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null

    // 백엔드가 만드는 결제 완료 메시지. PAYMENT 타입이면 그걸 쓰고, 아니면 접두사 메시지를 읽는다
    const prefixedPayment = msg.type === 'PAYMENT' ? null : parsePaymentMessage(msg.message)
    const paymentInfo =
      (msg.type === 'PAYMENT' ? msg.payment : null) ??
      (prefixedPayment && !serverPaidOrderIds.has(prefixedPayment.orderId) ? prefixedPayment : null)
    const paymentCard = paymentInfo ? <PaymentCard payment={paymentInfo} isSent={isSent} paidAt={msg.createdAt} /> : null
    // 블록체인 트랜잭션 해시. 백엔드가 blockchainTxHash → txHash 로 이름을 옮기는 중이라 둘 다 본다
    const txHash = paymentInfo ? paymentInfo.txHash ?? paymentInfo.blockchainTxHash : null

    const contractMsg = parseContractMessage(msg.message)
    const chatStart = parseChatStart(msg.message)
    // 서버 CALL 메시지가 기준이다. 접두사 메시지는 예전 기록이라 읽기만 하며, 그때는 발신자만 보냈으므로 isSent 가 곧 건 쪽이었다
    const serverCall = msg.type === 'CALL' ? msg.call : null
    const callLog = serverCall ?? parseCallLog(msg.message)
    const iAmCaller = serverCall ? serverCall.callerUsername === myUsername : isSent
    const callCard = callLog ? <CallLogCard log={callLog} isSent={isSent} iAmCaller={iAmCaller} /> : null

    const dealReq = parseDealRequest(msg.message)
    const dealEnd = parseDealEnd(msg.message)
    // 서버는 결제 승인으로 거래를 완료 처리한 직후 PAYMENT 메시지를 보낸다. 그래서 결제 카드 바로 아래에 완료 카드를 붙인다
    const dealCard =
      msg.type === 'PAYMENT' && msg.payment ? (
        <DealCard kind="completed" isSent={isSent} endedAt={msg.createdAt} />
      ) : dealReq ? (
        <DealCard kind="request" orderName={dealReq.orderName} amount={dealReq.amount} ended={tradeStatus === 'CANCELED' ? 'canceled' : 'completed'} />
      ) : dealEnd ? (
        <DealCard kind={dealEnd.kind} isSent={isSent} endedAt={msg.createdAt} />
      ) : null

    const textBubble =
      msg.message && !contractMsg && !paymentCard && !prefixedPayment && !callCard && !dealCard ? (
        <View style={[styles.bubble, { maxWidth: bubbleMaxWidth }, isSent ? styles.bubbleSent : styles.bubbleReceived]}>
          <Text size="sm" color={isSent ? colors.white : colors.black} selectable>
            {msg.message}
          </Text>
        </View>
      ) : null

    // 계약서는 제안을 받은 쪽이 검토·서명한다. 결제는 갑(게시글 작성자가 아닌 쪽)만 한다
    const contractCard = contractMsg ? (
      contractMsg.kind === 'propose' ? (
        <ContractCard
          kind="propose"
          isSent={isSent}
          price={contractMsg.data.price}
          startDate={contractMsg.data.startDate}
          endDate={contractMsg.data.endDate}
          serviceContent={contractMsg.data.serviceContent}
          sentAt={msg.createdAt}
          settled={idx < lastCompletedIdx}
          onReview={!isSent ? () => setContractModal({ mode: 'review', initial: contractMsg.data }) : undefined}
        />
      ) : (
        <ContractCard
          kind="completed"
          isSent={isSent}
          price={contractMsg.data.price}
          contractUrl={contractMsg.data.contractUrl}
          signedAt={msg.createdAt}
          paid={idx < lastPaymentIdx}
          onViewContract={contractMsg.data.contractUrl ? () => setViewingContractUrl(contractMsg.data.contractUrl) : undefined}
          onPay={myPartyRole === 'client' && selectedRoom.postId ? () => handlePayNavigate(contractMsg.data) : undefined}
        />
      )
    ) : null

    const content = (
      <>
        {attachment}
        {textBubble}
        {contractCard}
        {paymentCard}
        {callCard}
        {dealCard}
      </>
    )

    return (
      <View style={styles.messageBlock}>
        {showDateDivider ? (
          <View style={styles.dateDivider}>
            <View style={styles.datePill}>
              <Text size="xs" color={colors.zinc400}>
                {formatDateWithWeekday(msg.createdAt)}
              </Text>
            </View>
          </View>
        ) : null}
        {chatStart ? (
          <ChatStartCard
            postId={selectedRoom.postId}
            postTitle={selectedPost?.title}
            imageUrl={getPostMainImage(selectedPost?.fileUrls)}
            partnerName={selectedRoom.participantName}
            planName={chatStart.planName}
            price={chatStart.price}
          />
        ) : !isSent ? (
          <View style={styles.receivedRow}>
            <Avatar uri={selectedRoom.participantImageUrl} size={36} />
            <View style={styles.column}>{content}</View>
            {showTime ? (
              <Text size="xs" color={colors.zinc400}>
                {formatTime(msg.createdAt)}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.sentRow}>
            {showTime ? (
              <Text size="xs" color={colors.zinc400}>
                {formatTime(msg.createdAt)}
              </Text>
            ) : null}
            <View style={[styles.column, styles.alignEnd]}>{content}</View>
          </View>
        )}
        {/* 결제 해시는 카드 안에 넣기엔 길어서 대화 흐름 가운데에 한 줄로 남기고, 누르면 원문을 복사한다 */}
        {txHash ? (
          <View style={styles.dateDivider}>
            <Pressable onPress={() => copyHash(txHash)} style={styles.datePill}>
              <Text size="xs" color={colors.zinc400}>
                {copiedHash === txHash
                  ? '해시가 복사됐어요'
                  : `트랜잭션 해시 ${txHash.length > 20 ? `${txHash.slice(0, 10)}…${txHash.slice(-8)}` : txHash}`}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    )
  }

  if (!token) return <LoginRequired message="채팅은 로그인한 뒤 이용할 수 있어요." />

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 머리줄 */}
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} hitSlop={8} accessibilityLabel="채팅 목록으로" style={styles.iconButton}>
          <Ionicons name="chevron-back" size={22} color={colors.zinc600} />
        </Pressable>
        <Avatar uri={selectedRoom?.participantImageUrl} size={40} />
        <View style={styles.headerTexts}>
          <Text size="sm" weight="semibold" numberOfLines={1}>
            {selectedRoom?.participantName ?? ''}
          </Text>
          {selectedRoom ? (
            <Text size="xs" color={colors.zinc400} numberOfLines={1}>
              @{selectedRoom.participantUsername}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={() => void handleDeleteRoom()} hitSlop={8} accessibilityLabel="채팅방 나가기" style={styles.iconButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.zinc500} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.flex}>
          <FlatList
            data={reversed}
            inverted
            keyExtractor={(msg, index) => (msg.messageId != null ? String(msg.messageId) : `${msg.createdAt}-${index}`)}
            renderItem={({ index }) => renderMessage(messages[messages.length - 1 - index], messages.length - 1 - index)}
            contentContainerStyle={styles.messages}
            onEndReached={() => void loadOlder()}
            onEndReachedThreshold={0.3}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            keyboardShouldPersistTaps="handled"
          />
          {/* 뒤집힌 목록은 비었을 때 안내가 거꾸로 그려져 목록 밖에 겹쳐 둔다 */}
          {messages.length === 0 ? (
            <View style={styles.emptyOverlay} pointerEvents="none">
              {loadingMessages || !selectedRoom ? (
                <ActivityIndicator color={colors.main} />
              ) : (
                <Text size="sm" color={colors.zinc400}>
                  대화를 시작해보세요.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {/* 입력 영역. 거래가 끝나도 대화는 막지 않는다 */}
        <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
          {showAttach ? (
            <View style={styles.attachMenu}>
              <AttachButton icon="image" label="사진" color={colors.main} onPress={() => void handlePickImages()} />
              <AttachButton icon="description" label="문서" color={colors.orange300} onPress={() => void handlePickDocument()} />
              {myPartyRole === 'professional' ? (
                <AttachButton
                  icon="assignment"
                  label="계약서"
                  color={colors.yellow400}
                  onPress={() => {
                    setShowAttach(false)
                    setContractModal({
                      mode: 'propose',
                      // 금액은 계약서를 쓰는 을이 직접 입력한다(문의 때 고른 서비스 가격은 갑의 기기에만 남아 있어 여기서는 알 수 없다)
                      initial: { clientName: selectedRoom?.participantName ?? '', professionalName: '' },
                    })
                  }}
                />
              ) : null}
              {/* 갑·을 누구든 진행 중인 거래를 그만둘 수 있다. 끝난 거래는 서버가 취소를 받지 않아 버튼을 숨긴다 */}
              {tradeStatus === 'IN_PROGRESS' ? (
                <AttachButton icon="cancel" label="거래 취소" color={colors.zinc500} disabled={dealBusy} onPress={() => void handleCancelTrade()} />
              ) : null}
            </View>
          ) : null}

          {pendingImages.length > 0 ? (
            <View style={styles.pendingRow}>
              {pendingImages.map((img) => (
                <View key={img.key} style={styles.pendingImage}>
                  <Image source={{ uri: img.url ? toAbsoluteUrl(img.url) : img.preview }} style={styles.fill} contentFit="cover" />
                  {!img.url ? (
                    <View style={styles.pendingOverlay}>
                      <Text size="xs" color={colors.white}>
                        업로드 중
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setPendingImages((prev) => prev.filter((p) => p.key !== img.key))}
                      accessibilityLabel="첨부 사진 빼기"
                      style={styles.removeImage}
                    >
                      <Ionicons name="close" size={12} color={colors.white} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {pendingDoc ? (
            <View style={styles.pendingDoc}>
              <MaterialIcons name="description" size={18} color={colors.zinc500} />
              <Text size="xs" color={colors.zinc600} numberOfLines={1} style={styles.pendingDocName}>
                {pendingDoc.name}
              </Text>
              {!pendingDoc.url ? (
                <Text size="xs" color={colors.zinc400}>
                  업로드 중
                </Text>
              ) : (
                <Pressable onPress={() => setPendingDoc(null)} hitSlop={8} accessibilityLabel="첨부 문서 빼기">
                  <Ionicons name="close" size={14} color={colors.zinc400} />
                </Pressable>
              )}
            </View>
          ) : null}

          <View style={styles.inputBar}>
            <Pressable
              onPress={() => setShowAttach((v) => !v)}
              accessibilityLabel={showAttach ? '첨부 메뉴 닫기' : '첨부 메뉴 열기'}
              style={[styles.plus, showAttach && styles.plusOpen]}
            >
              <Ionicons name="add" size={22} color={showAttach ? colors.white : colors.zinc500} style={showAttach ? styles.rotated : undefined} />
            </Pressable>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={connected ? '메시지 입력' : '연결 중...'}
              placeholderTextColor={colors.zinc400}
              multiline
              onFocus={() => {
                if (roomId) markRoomRead(roomId)
              }}
              selectionColor={colors.main}
              cursorColor={colors.main}
              style={styles.input}
            />
            <Pressable onPress={handleSend} disabled={uploading} accessibilityLabel="보내기" style={[styles.send, uploading && styles.dim]}>
              <Ionicons name="send" size={16} color={colors.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      {contractModal && myPartyRole ? (
        <ContractWizardModal
          myRole={myPartyRole}
          mode={contractModal.mode}
          initial={contractModal.initial}
          busy={contractBusy}
          phoneVerified={phoneVerified}
          onClose={() => setContractModal(null)}
          onOpenProfile={() => {
            setContractModal(null)
            router.push('/profile')
          }}
          onSubmit={(data, pdf) => void handleContractSubmit(data, pdf)}
        />
      ) : null}
      {viewingContractUrl ? <ContractViewerModal url={viewingContractUrl} onClose={() => setViewingContractUrl(null)} /> : null}
    </View>
  )
}

function AttachButton({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  color: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <View style={styles.attachItem}>
      <Pressable onPress={onPress} disabled={disabled} style={[styles.attachCircle, { backgroundColor: color }, disabled && styles.dim]}>
        <MaterialIcons name={icon} size={24} color={colors.white} />
      </Pressable>
      <Text size="xs" color={colors.zinc500}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  shrink: { flexShrink: 1 },
  dim: { opacity: 0.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: { flex: 1, gap: 2 },
  messages: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    gap: 16,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBlock: { gap: 8 },
  dateDivider: { alignItems: 'center', paddingVertical: 8 },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.zinc100,
  },
  receivedRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  sentRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 10 },
  column: { gap: 4, flexShrink: 1 },
  alignEnd: { alignItems: 'flex-end' },
  justifyEnd: { justifyContent: 'flex-end' },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius['2xl'],
  },
  bubbleSent: { backgroundColor: colors.main, borderBottomRightRadius: 0 },
  bubbleReceived: { backgroundColor: colors.zinc100, borderBottomLeftRadius: 0 },
  attachments: { gap: 4 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  attachedImage: { width: 96, height: 96, borderRadius: radius.xl },
  docChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.zinc100,
  },
  composer: {
    gap: 12,
    paddingHorizontal: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  attachMenu: { flexDirection: 'row', gap: 24, paddingHorizontal: 8 },
  attachItem: { alignItems: 'center', gap: 4 },
  attachCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pendingImage: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingDoc: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.zinc100,
  },
  pendingDocName: { maxWidth: 160 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.zinc200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusOpen: { backgroundColor: colors.main },
  rotated: { transform: [{ rotate: '45deg' }] },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: 110,
    minHeight: 36,
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    color: colors.black,
    paddingVertical: 8,
    textAlignVertical: 'center',
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
