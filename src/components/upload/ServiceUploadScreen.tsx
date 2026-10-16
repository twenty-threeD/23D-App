import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import TextField from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import BackHeader from '@/components/BackHeader'
import LoginRequired from '@/components/LoginRequired'
import FieldLabel from '@/components/upload/FieldLabel'
import UploadImages from '@/components/upload/UploadImages'
import PriceCardEditor from '@/components/upload/PriceCardEditor'
import UploadPreview from '@/components/upload/UploadPreview'
import { colors, PAGE_X } from '@/constants/theme'
import { createPost, getPost, getPostCategories, updatePost, type PostCategory } from '@/lib/post'
import { DEFAULT_PLAN, parsePostContent, serializePostContent, type PriceCardPlan } from '@/lib/priceCard'
import { formatPriceInput, toPriceDigits } from '@/lib/amount'
import { useHandleError } from '@/hooks/useHandleError'
import { decodeJwtUsername, useAuthStore } from '@/store/authStore'

const MAX_TITLE = 255
// 서버가 본문을 2000자로 제한한다. 본문에는 플랜 정보까지 함께 직렬화되므로
// 입력칸 글자 수 제한과 별개로 등록할 때 직렬화한 길이로 한 번 더 검사한다
const MAX_CONTENT = 2000

// 웹 /upload/[[...id]]. postId 가 있으면 수정, 없으면 새로 등록한다
export default function ServiceUploadScreen({ postId }: { postId: number | null }) {
  const token = useAuthStore((s) => s.accessToken)
  // 토큰은 만료 직전·앱 복귀 때 재발급된다. 토큰 값에 의존하면 재발급마다 다시 불러와 편집 중인 내용을 덮어써서,
  // 로그인 여부에만 의존하고 요청에는 그 시점의 최신 토큰을 쓴다
  const hasToken = !!token
  const myUsername = useAuthStore((s) => s.username ?? (s.accessToken ? decodeJwtUsername(s.accessToken) : null))
  const handleError = useHandleError()
  // useHandleError 는 경로가 바뀌면 새 함수를 돌려줘서, 불러오기 의존성에 넣으면 다시 불러오며 쓰던 내용을 덮는다
  const handleErrorRef = useRef(handleError)
  useEffect(() => {
    handleErrorRef.current = handleError
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [plans, setPlans] = useState<PriceCardPlan[]>([DEFAULT_PLAN])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<PostCategory[]>([])
  const [submitting, setSubmitting] = useState(false)
  // 불러오기를 끝낸 게시글 번호. 로딩 여부는 이 값으로 파생시킨다(effect 안에서 동기적으로 setState 하지 않기 위함)
  const [loadedPostId, setLoadedPostId] = useState<number | null>(null)
  const loading = !!postId && loadedPostId !== postId

  useEffect(() => {
    let cancelled = false
    getPostCategories()
      .then((list) => {
        if (!cancelled) setCategories(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) void handleErrorRef.current(e)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 수정 모드일 때 기존 게시글을 불러온다. 응답이 늦게 도착한 뒤 다른 글로 이동한 경우를 대비해 취소 플래그를 둔다
  useEffect(() => {
    if (!postId || !hasToken) return
    let cancelled = false
    getPost(postId, useAuthStore.getState().accessToken)
      .then(({ data: post }) => {
        if (cancelled) return
        if (post.member?.username && myUsername && post.member.username !== myUsername) {
          router.replace(`/item/${postId}`)
          return
        }
        setTitle(post.title ?? '')
        // 서버 이미지 순서: 헤더 이미지, 메인 이미지, 나머지 이미지
        setImageUrls(post.fileUrls ?? [])
        setCategoryId(post.category?.id ?? null)
        const { description: desc, plans: existingPlans } = parsePostContent(post.content ?? '')
        setDescription(desc ?? '')
        setPlans(existingPlans.length > 0 ? existingPlans : [DEFAULT_PLAN])
        setPrice(existingPlans[0]?.price ?? '')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        void handleErrorRef.current(e)
        router.replace('/')
      })
      .finally(() => {
        if (!cancelled) setLoadedPostId(postId)
      })
    return () => {
      cancelled = true
    }
  }, [postId, hasToken, myUsername])

  async function handleSubmit() {
    const current = useAuthStore.getState().accessToken
    if (!current || submitting) return
    if (!title.trim() || !description.trim()) {
      toast.warning('제목과 본문을 입력해주세요.')
      return
    }
    if (categoryId === null) {
      toast.warning('카테고리를 선택해주세요.')
      return
    }
    if (!imageUrls[0]) {
      toast.warning('헤더 이미지를 업로드해주세요.')
      return
    }
    if (!imageUrls[1]) {
      toast.warning('메인 이미지를 업로드해주세요.')
      return
    }
    if (title.length > MAX_TITLE) {
      toast.warning(`제목은 ${MAX_TITLE}자 이하여야 합니다.`)
      return
    }

    // 위의 '최소 가격' 칸이 첫 플랜의 가격이 된다(웹과 같다)
    const effectivePlans = plans.map((p, i) => (i === 0 ? { ...p, price: price || p.price } : p))
    const content = serializePostContent(description, effectivePlans)
    if (content.length > MAX_CONTENT) {
      toast.warning(`본문은 플랜 내용을 포함해 ${MAX_CONTENT}자 이하여야 합니다.`)
      return
    }

    setSubmitting(true)
    try {
      if (postId) {
        await updatePost(current, { id: postId, title, content, fileUrls: imageUrls, categoryId })
        // 작성·수정을 마친 뒤 뒤로가기로 이 화면에 돌아오지 않도록 치환한다
        router.replace(`/item/${postId}`)
      } else {
        const res = await createPost(current, { title, content, fileUrls: imageUrls, categoryId })
        const newId = res.data?.id
        // 번호를 못 받아도 등록은 끝났다. 폼에 남겨 두면 다시 눌러 같은 글이 두 번 올라갈 수 있어 메인으로 보낸다
        router.replace(newId ? `/item/${newId}` : '/')
      }
    } catch (e) {
      void handleError(e)
    } finally {
      setSubmitting(false)
    }
  }

  const screenTitle = postId ? '서비스 수정' : '서비스 등록'

  if (!token) {
    return (
      <View style={styles.container}>
        <BackHeader title={screenTitle} />
        <LoginRequired message="서비스를 등록하려면 로그인해주세요." />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BackHeader
        title={screenTitle}
        right={
          <Button size="sm" loading={submitting} disabled={loading} onPress={() => void handleSubmit()}>
            {submitting ? (postId ? '수정 중...' : '등록 중...') : postId ? '수정' : '등록'}
          </Button>
        }
      />
      {loading ? (
        <Text color={colors.zinc400} align="center" style={styles.message}>
          불러오는 중...
        </Text>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <UploadImages value={imageUrls} onChange={setImageUrls} />

            <View style={styles.fields}>
              <View style={styles.field}>
                <FieldLabel essential>카테고리</FieldLabel>
                <Select
                  title="카테고리"
                  placeholder="카테고리를 선택해주세요."
                  value={categoryId}
                  options={categories.map((c) => ({ label: c.fullName, value: c.id }))}
                  onChange={setCategoryId}
                />
              </View>
              <View style={styles.field}>
                <FieldLabel essential>제목</FieldLabel>
                <TextField value={title} onChangeText={setTitle} maxLength={MAX_TITLE} placeholder="제목을 입력해주세요." />
              </View>
              <View style={styles.field}>
                <FieldLabel
                  essential
                  aside={
                    <Text size="xs" weight="medium" color={colors.inkHint}>
                      {description.length}/{MAX_CONTENT}
                    </Text>
                  }
                >
                  본문
                </FieldLabel>
                <TextField
                  value={description}
                  onChangeText={setDescription}
                  maxLength={MAX_CONTENT}
                  placeholder="본문을 입력해주세요."
                  multiline
                  style={styles.descriptionInput}
                />
              </View>
              <View style={styles.field}>
                <FieldLabel essential>최소 가격</FieldLabel>
                <TextField
                  value={formatPriceInput(price)}
                  // 상태에는 콤마 없는 순수 숫자 문자열만 저장한다
                  onChangeText={(v) => {
                    const digits = toPriceDigits(v)
                    if (digits !== null) setPrice(digits)
                  }}
                  keyboardType="number-pad"
                  placeholder="최소 가격을 입력해주세요."
                  right={
                    <Text size="xs" color={colors.inkHint}>
                      원
                    </Text>
                  }
                />
              </View>
            </View>

            <PriceCardEditor plans={plans} onChange={setPlans} />

            <UploadPreview imageUrl={imageUrls[1] || imageUrls[0]} title={title} description={description} price={price || plans[0]?.price} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  message: { paddingVertical: 80 },
  content: { padding: PAGE_X, gap: 48, paddingBottom: 64 },
  fields: { gap: 32 },
  field: { gap: 12 },
  // 웹 본문 칸(h-60)과 같은 높이로 시작해 길게 써도 칸이 너무 작아 보이지 않게 한다
  descriptionInput: { minHeight: 240 },
})
