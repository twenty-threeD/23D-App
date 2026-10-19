import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import TextField from '@/components/ui/TextField'
import BackHeader from '@/components/BackHeader'
import PostImage from '@/components/PostImage'
import ImageLightbox from '@/components/ImageLightbox'
import StarRating from '@/components/StarRating'
import Review from '@/components/item/Review'
import ReviewAnalysis from '@/components/item/ReviewAnalysis'
import PriceCard from '@/components/item/PriceCard'
import InquiryButton from '@/components/item/InquiryButton'
import ServiceSection from '@/components/main/ServiceSection'
import { toast } from '@/components/ui/Toast'
import { colors, PAGE_X, radius } from '@/constants/theme'
import { favoritePost, getFavoritePosts, getPost, getRankedPosts, POPULAR_SORT, REVISIT_SORT, unfavoritePost, type Post } from '@/lib/post'
import { parsePostContent } from '@/lib/priceCard'
import { createReview, getReviewableContracts, getReviews, type Review as ReviewData, type ReviewableContract } from '@/lib/review'
import { ApiError } from '@/lib/apiError'
import { signinHref } from '@/lib/navigation'
import { formatLocaleDate } from '@/lib/date'
import { useAuthStore } from '@/store/authStore'
import { useHandleError } from '@/hooks/useHandleError'

// 서비스 설명은 길면 접어서 시작한다(웹 line-clamp-[16])
const COLLAPSED_LINES = 16

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const postId = Number(id) || null
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const token = useAuthStore((s) => s.accessToken)
  const myUsername = useAuthStore((s) => s.username)
  const handleError = useHandleError()

  // 어떤 글을 받은 결과인지 같이 들고 있어, 다른 글로 옮겨 오면 자동으로 불러오는 중이 된다
  const [loaded, setLoaded] = useState<{ postId: number; post: Post | null } | null>(null)
  const [popularPosts, setPopularPosts] = useState<Post[]>([])
  const [revisitPosts, setRevisitPosts] = useState<Post[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  // 후기는 글이 아니라 계약 단위로 남는다. 서버가 "지금 후기를 쓸 수 있는 내 계약"만 골라주므로
  // 이 목록이 비어 있으면 폼을 숨기고, 여러 건이면 어느 전문가와의 계약인지 고르게 한다
  const [reviewableContracts, setReviewableContracts] = useState<ReviewableContract[]>([])
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)
  // 목록이 바뀌면(후기를 써서 하나 빠짐 등) 고른 계약이 사라질 수 있어, 그때는 가장 최근 계약으로 본다
  const activeContractId = reviewableContracts.some((c) => c.contractId === selectedContractId)
    ? selectedContractId
    : reviewableContracts[0]?.contractId ?? null

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    getPost(postId, token)
      .then((res) => {
        if (!cancelled) setLoaded({ postId, post: res.data ?? null })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ postId, post: null })
      })
    return () => {
      cancelled = true
    }
  }, [postId, token])

  useEffect(() => {
    getRankedPosts(POPULAR_SORT)
      .then(setPopularPosts)
      .catch(() => {})
    getRankedPosts(REVISIT_SORT)
      .then(setRevisitPosts)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!token || !postId) return
    getFavoritePosts(token)
      .then((list) => setIsFavorited(list.some((p) => p.id === postId)))
      .catch(() => {})
  }, [token, postId])

  useEffect(() => {
    if (!postId) return
    getReviews(postId, token)
      .then(setReviews)
      .catch(() => setReviews([]))
  }, [postId, token])

  useEffect(() => {
    // 비로그인이면 서버가 401 을 주므로 묻지 않는다. 조회에 실패해도 폼만 숨기면 되는 값이라 조용히 비운다
    if (!token || !postId) return
    getReviewableContracts(token, postId)
      .then(setReviewableContracts)
      .catch(() => setReviewableContracts([]))
  }, [postId, token])

  async function handleToggleFavorite() {
    if (!token || !postId) {
      router.push(signinHref(pathname) as never)
      return
    }
    setFavoriteBusy(true)
    try {
      if (isFavorited) {
        await unfavoritePost(token, postId)
        setIsFavorited(false)
      } else {
        await favoritePost(token, postId)
        setIsFavorited(true)
      }
    } catch (e) {
      void handleError(e)
    } finally {
      setFavoriteBusy(false)
    }
  }

  async function handleCreateReview() {
    if (!token || !postId) {
      router.push(signinHref(pathname) as never)
      return
    }
    if (activeContractId === null) return
    const content = reviewContent.trim()
    if (!content) return

    setReviewBusy(true)
    try {
      const created = await createReview(token, { contractId: activeContractId, rating: reviewRating, content })
      const newReview: ReviewData = created ?? {
        id: `local-${Date.now()}`,
        rating: reviewRating,
        content,
        createdAt: new Date().toISOString(),
        author: { username: myUsername },
      }
      setReviews((current) => [newReview, ...current])
      // 한 계약에는 후기를 한 번만 쓸 수 있어 방금 쓴 계약을 목록에서 뺀다. 남은 계약이 없으면 폼이 사라진다
      setReviewableContracts((current) => current.filter((c) => c.contractId !== activeContractId))
      setReviewContent('')
      setReviewRating(5)
    } catch (e) {
      // 버튼은 결제를 마친 계약에만 보이지만, 그 사이 결제가 취소되면 서버가 막는다. 공통 처리보다 구체적으로 안내한다
      if (e instanceof ApiError && e.code === 'REVIEW_PAYMENT_REQUIRED') {
        toast.error('결제가 완료된 계약만 리뷰를 작성할 수 있습니다.')
        return
      }
      void handleError(e)
    } finally {
      setReviewBusy(false)
    }
  }

  const loading = !!postId && loaded?.postId !== postId
  const post = loaded?.postId === postId ? loaded.post : null

  // id 없이 들어오거나 없는 글(404)이면 빈 상세 화면 대신 안내를 띄운다
  if (!postId || (!loading && !post)) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <Text color={colors.inkMuted} align="center" style={styles.message}>
          존재하지 않는 서비스입니다.
        </Text>
      </View>
    )
  }

  if (loading || !post) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <Text color={colors.inkMuted} align="center" style={styles.message}>
          불러오는 중...
        </Text>
      </View>
    )
  }

  const { description, plans } = parsePostContent(post.content)
  const isOwner = !!(post.member?.username && myUsername && post.member.username === myUsername)
  // 로그아웃하면 이전 계정의 목록이 남지 않도록 토큰이 있을 때만 쓴다
  const myReviewableContracts = token ? reviewableContracts : []
  const canReview = myReviewableContracts.length > 0
  const reviewCount = reviews.length
  const average = reviewCount > 0 ? reviews.reduce((total, item) => total + item.rating, 0) / reviewCount : 0
  const headerImage = post.fileUrls?.[0] ?? null
  const contentImages = post.fileUrls && post.fileUrls.length > 1 ? post.fileUrls.slice(1) : post.fileUrls ?? []

  return (
    <View style={styles.container}>
      <BackHeader
        right={
          isOwner ? (
            <Button variant="secondary" size="sm" onPress={() => router.push(`/upload/${postId}`)}>
              수정
            </Button>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.main}>
          <PostImage uri={headerImage} style={styles.headerImage} />

          {/* 제목 */}
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <Text size="2xl" weight="semibold" style={styles.title}>
                {post.title ?? '제목 없음'}
              </Text>
              {post.category ? (
                <Text weight="medium" color={colors.inkHint}>
                  {post.category.fullName ?? post.category.name}
                </Text>
              ) : null}
            </View>
            <Text weight="semibold" color={colors.inkHint}>
              {post.member?.name ?? post.member?.username}
            </Text>
          </View>

          {/* 휴대폰에서는 사이드바(가격 카드)가 제목 아래로 내려온다. 문의하기는 하단 고정 바가 맡는다 */}
          <View style={styles.side}>
            <PriceCard username={post.member?.username} plans={plans} postId={postId} showInquiry={false} />
            <View style={styles.notice}>
              {['서비스 이후 금액이 전달 되니 안전하게 거래하세요.', '견적서와 계약서는 블록체인을 통해 평생 안전히 보관됩니다.'].map((line) => (
                <View key={line} style={styles.noticeRow}>
                  <Text size="sm" color={colors.inkSub}>
                    •
                  </Text>
                  <Text size="sm" color={colors.inkSub} style={styles.flex}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 서비스 설명 */}
          <View style={styles.block}>
            <Text size="2xl" weight="semibold">
              서비스 설명
            </Text>
            <Text
              weight="medium"
              color={colors.inkSub}
              style={styles.description}
              numberOfLines={isExpanded ? undefined : COLLAPSED_LINES}
              onTextLayout={(e) => {
                if (!isExpanded && !canExpand && e.nativeEvent.lines.length >= COLLAPSED_LINES) setCanExpand(true)
              }}
            >
              {description || '서비스 설명이 없습니다.'}
            </Text>
            {canExpand ? (
              <Pressable onPress={() => setIsExpanded((v) => !v)} style={styles.expand}>
                <Text weight="medium" color={colors.inkHint}>
                  {isExpanded ? '접기' : '더보기'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* 본문 이미지 — 올린 이미지를 볼 곳이 여기뿐이라 있을 때만 보여준다 */}
          {contentImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
              {contentImages.map((url, i) => (
                <Pressable key={`${url}-${i}`} onPress={() => setLightboxSrc(url)} accessibilityLabel={`이미지 ${i + 1} 크게 보기`}>
                  <PostImage uri={url} style={styles.contentImage} fallback={false} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {/* 리뷰 */}
          <View style={styles.reviews}>
            <View style={styles.reviewHeader}>
              <Text size="xl" weight="semibold">
                리뷰
              </Text>
              <View style={styles.reviewSummary}>
                <StarRating rating={average} size="lg" />
                <Text size="xl" weight="medium">
                  {average ? average.toFixed(1) : '-'}{' '}
                  <Text color={colors.inkSub}>({reviewCount})</Text>
                </Text>
              </View>
            </View>

            {/* AI 총평은 전문가 전체가 아니라 이 글의 리뷰를 기준으로 보여준다 */}
            <ReviewAnalysis postId={postId} />

            {/* 후기는 이 글에서 내가 의뢰인으로 결제까지 마친 계약에만, 계약당 한 번 남길 수 있다 */}
            {canReview ? (
              <View style={styles.reviewForm}>
                <View style={styles.reviewFormHeader}>
                  <Text weight="semibold">후기 남기기</Text>
                  <View style={styles.reviewSummary}>
                    <StarRating rating={reviewRating} interactive onChange={setReviewRating} />
                    <Text size="sm" weight="semibold" color={colors.inkSub}>
                      {reviewRating}.0
                    </Text>
                  </View>
                </View>
                {/* 계약이 하나면 고를 게 없어 감춘다. 같은 전문가와 여러 번 계약했을 수 있어 계약일을 같이 보여준다 */}
                {myReviewableContracts.length > 1 ? (
                  <Select
                    title="후기를 남길 계약"
                    value={activeContractId}
                    options={myReviewableContracts.map((c) => ({
                      label: `${c.professionalName}${c.createdAt ? ` · ${formatLocaleDate(c.createdAt)} 계약` : ''}`,
                      value: c.contractId,
                    }))}
                    onChange={setSelectedContractId}
                  />
                ) : null}
                <TextField
                  value={reviewContent}
                  onChangeText={(v) => setReviewContent(v.slice(0, 500))}
                  placeholder="서비스는 어떠셨나요? 후기를 남겨주세요."
                  maxLength={500}
                  multiline
                  numberOfLines={4}
                  containerStyle={styles.reviewInput}
                />
                <View style={styles.reviewFormFooter}>
                  <Text size="xs" color={colors.inkMuted}>
                    {reviewContent.length} / 500
                  </Text>
                  <Button loading={reviewBusy} disabled={!reviewContent.trim()} onPress={() => void handleCreateReview()} style={styles.reviewSubmit}>
                    {reviewBusy ? '등록 중...' : '후기 등록'}
                  </Button>
                </View>
              </View>
            ) : null}

            {reviews.length > 0 ? (
              <View style={styles.reviewList}>
                {reviews.map((item) => (
                  <Review key={item.id} review={item} />
                ))}
              </View>
            ) : (
              <Text weight="medium" color={colors.inkHint}>
                아직 작성된 리뷰가 없어요.
              </Text>
            )}
          </View>
        </View>

        <View style={styles.related}>
          <ServiceSection title="재방문율이 높아요" section="revisit" loading={false} posts={revisitPosts} />
          <ServiceSection title="이웃들이 많이 찾아요" section="popular" loading={false} posts={popularPosts} />
        </View>
      </ScrollView>

      {/* 휴대폰 하단 문의 바. 내 글에서는 문의할 일이 없어 숨긴다 */}
      {!isOwner ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            onPress={() => void handleToggleFavorite()}
            disabled={favoriteBusy}
            accessibilityLabel="찜하기"
            style={[styles.heart, favoriteBusy && styles.disabled]}
          >
            <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={24} color={colors.main} />
          </Pressable>
          <View style={styles.flex}>
            <InquiryButton username={post.member?.username} postId={postId} plans={plans} style={styles.inquiry} />
          </View>
        </View>
      ) : null}

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  message: { paddingVertical: 80 },
  content: {
    paddingVertical: 24,
    gap: 80,
  },
  main: {
    paddingHorizontal: PAGE_X,
    gap: 40,
  },
  headerImage: {
    height: 180,
    borderRadius: radius['2xl'],
  },
  titleBlock: {
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    columnGap: 16,
    rowGap: 4,
  },
  title: {
    flexShrink: 1,
  },
  side: {
    gap: 8,
  },
  notice: {
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  block: {
    gap: 24,
  },
  description: {
    lineHeight: 22,
  },
  expand: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inkHint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  images: {
    gap: 16,
  },
  contentImage: {
    width: 192,
    height: 192,
    borderRadius: radius.xl,
  },
  reviews: {
    gap: 48,
  },
  reviewHeader: {
    gap: 16,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewForm: {
    gap: 12,
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  reviewFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewInput: {
    minHeight: 100,
  },
  reviewFormFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewSubmit: {
    borderRadius: radius.lg,
  },
  reviewList: {
    gap: 24,
  },
  related: {
    gap: 80,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PAGE_X,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  heart: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  inquiry: {
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
})
