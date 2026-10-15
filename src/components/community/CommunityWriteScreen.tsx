import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { router, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import BackHeader from '@/components/BackHeader'
import LoginRequired from '@/components/LoginRequired'
import { colors, FONT_FAMILY, PAGE_X, radius } from '@/constants/theme'
import {
  COMMUNITY_CATEGORIES,
  createPost,
  getPost,
  isCommunityCategory,
  parseRegion,
  tagRegion,
  updatePost,
  type CommunityCategory,
} from '@/lib/community'
import { toUploadPath, uploadFile } from '@/lib/file'
import { pickImages } from '@/lib/pickers'
import { signinHref } from '@/lib/navigation'
import { useMyLocation } from '@/hooks/useMyLocation'
import { useHandleError } from '@/hooks/useHandleError'
import { useAuthStore, decodeJwtUsername } from '@/store/authStore'

const TITLE_MAX = 100

// 본문 마크다운에서 첫 번째 이미지를 대표 이미지(fileUrl)로 쓴다.
// 서버가 업로드 경로(/files/<파일명>)만 받아, 본문에 붙여넣은 외부 이미지는 건너뛰고 업로드한 이미지 중 첫 번째를 쓴다
function extractFileUrl(md: string) {
  for (const m of md.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const path = toUploadPath(m[1])
    if (path) return path
  }
  return null
}

export default function CommunityWriteScreen({ postId }: { postId: number | null }) {
  const pathname = usePathname()
  const token = useAuthStore((s) => s.accessToken)
  // 토큰은 만료 직전·앱 복귀 때 재발급된다. 토큰 값에 의존하면 재발급마다 다시 불러와 쓰던 내용을 덮어써서,
  // 로그인 여부에만 의존하고 요청에는 그 시점의 최신 토큰을 쓴다
  const hasToken = !!token
  const myUsername = useAuthStore((s) => s.username ?? (s.accessToken ? decodeJwtUsername(s.accessToken) : null))
  const handleError = useHandleError()
  const { location, loaded: locationLoaded } = useMyLocation()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<CommunityCategory | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadedPostId, setLoadedPostId] = useState<number | null>(null)
  const loading = !!postId && loadedPostId !== postId
  // 이미지는 본문의 커서 자리에 넣는다. 입력칸이 마지막으로 알려준 커서 위치를 들고 있는다
  const selectionRef = useRef({ start: 0, end: 0 })

  useEffect(() => {
    if (!postId || !hasToken) return
    let cancelled = false
    getPost(postId, useAuthStore.getState().accessToken)
      .then((res) => {
        if (cancelled) return
        const data = res.data ?? res
        if (data.username && myUsername && data.username !== myUsername) {
          router.replace(`/posts/${postId}`)
          return
        }
        setTitle(data.title ?? '')
        // 지역 태그는 등록할 때 다시 붙이므로 입력칸에는 본문만 보여준다
        setContent(parseRegion(data.content).body)
        const c = typeof data.category === 'string' ? data.category : data.category?.name
        if (isCommunityCategory(c)) setCategory(c)
      })
      .catch((e) => {
        if (cancelled) return
        void handleError(e)
        router.replace('/community')
      })
      .finally(() => {
        if (!cancelled) setLoadedPostId(postId)
      })
    return () => {
      cancelled = true
    }
    // handleError 는 경로가 바뀌면 새로 만들어져 넣으면 다시 불러오며 쓰던 내용을 덮는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, hasToken, myUsername])

  async function handleInsertImages() {
    const current = useAuthStore.getState().accessToken
    if (!current) return
    const files = await pickImages({ multiple: true })
    if (files.length === 0) return
    setUploading(true)
    let insertPos = selectionRef.current.start
    // 올리는 동안에도 계속 입력할 수 있어, 시작할 때의 본문이 아니라 그때그때의 최신 본문에 끼워 넣는다
    for (const file of files) {
      try {
        const { url } = await uploadFile(current, file)
        const md = `![image](${url})\n`
        const pos = insertPos
        setContent((prev) => {
          const at = Math.min(pos, prev.length)
          return prev.slice(0, at) + md + prev.slice(at)
        })
        insertPos += md.length
      } catch (e) {
        void handleError(e)
      }
    }
    selectionRef.current = { start: insertPos, end: insertPos }
    setUploading(false)
  }

  const needsLocation = category === 'NEIGHBORHOOD' && locationLoaded && !location
  const isReady = title.trim().length > 0 && content.trim().length > 0 && !!category && (category !== 'NEIGHBORHOOD' || !!location)

  async function handleSubmit() {
    const current = useAuthStore.getState().accessToken
    if (!current) {
      router.push(signinHref(pathname) as never)
      return
    }
    if (!isReady || !category) return
    setSubmitting(true)
    // 수정 시에도 지금 지역으로 다시 태그한다. 이사한 뒤 고친 글은 새 지역에 보이는 게 자연스럽다(웹과 같다)
    const body = category === 'NEIGHBORHOOD' && location ? tagRegion(content, location.ctprvnCd) : parseRegion(content).body
    try {
      if (postId) {
        await updatePost(current, postId, { title, content: body, category, fileUrl: extractFileUrl(body) })
        // 작성·수정을 마친 뒤 뒤로가기로 이 화면에 돌아오지 않도록 치환한다
        router.replace(`/posts/${postId}`)
      } else {
        const res = await createPost(current, { title, content: body, category, fileUrl: extractFileUrl(body) })
        const newId = res.data?.postId
        router.replace(newId ? `/posts/${newId}` : '/community')
      }
    } catch (e) {
      void handleError(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <BackHeader fallbackHref="/community" />
        <LoginRequired message="글을 쓰려면 로그인해주세요." />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BackHeader
        title={postId ? '글 수정' : '글쓰기'}
        fallbackHref="/community"
        right={
          <Button size="sm" loading={submitting} disabled={!isReady || loading} onPress={() => void handleSubmit()}>
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
            <View style={styles.box}>
              <View style={styles.titleRow}>
                <TextInput
                  value={title}
                  onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
                  placeholder="제목을 입력해주세요."
                  placeholderTextColor={colors.zinc300}
                  maxLength={TITLE_MAX}
                  selectionColor={colors.main}
                  cursorColor={colors.main}
                  style={styles.titleInput}
                />
                <Text size="sm" color={colors.zinc400}>
                  {title.length} / {TITLE_MAX}
                </Text>
              </View>

              <TextInput
                value={content}
                onChangeText={setContent}
                onSelectionChange={(e) => {
                  selectionRef.current = e.nativeEvent.selection
                }}
                placeholder={'내용을 입력해주세요.\n마크다운 문법(# 제목, **굵게**, - 목록)을 쓸 수 있어요.'}
                placeholderTextColor={colors.zinc300}
                multiline
                textAlignVertical="top"
                selectionColor={colors.main}
                cursorColor={colors.main}
                style={styles.contentInput}
              />

              <View style={styles.categoryBlock}>
                <Text size="xl" weight="bold">
                  카테고리<Text size="xl" weight="bold" color={colors.red500}>*</Text>
                </Text>
                <Select
                  title="카테고리"
                  placeholder="카테고리를 선택해주세요"
                  value={category}
                  options={COMMUNITY_CATEGORIES.map((c) => ({ label: c.label, value: c.value }))}
                  onChange={(value) => setCategory(value)}
                />
                {category === 'NEIGHBORHOOD' && location ? (
                  <Text size="sm" color={colors.zinc500}>
                    {location.locationName.split(' ')[0]} 주민에게만 보이는 글입니다.
                  </Text>
                ) : null}
                {needsLocation ? (
                  <Text size="sm" color={colors.red500}>
                    동네 주민 글을 쓰려면 프로필에서 지역을 먼저 설정해주세요.
                  </Text>
                ) : null}
              </View>

              <View style={styles.toolbar}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={uploading}
                  icon={<Ionicons name="image-outline" size={18} color={colors.zinc600} />}
                  onPress={() => void handleInsertImages()}
                >
                  {uploading ? '업로드 중...' : '이미지 삽입'}
                </Button>
                <Text size="xs" color={colors.zinc400} style={styles.flex}>
                  본문에서 넣을 자리에 커서를 두고 누르세요
                </Text>
              </View>
            </View>
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
  content: { padding: PAGE_X, paddingBottom: 48 },
  box: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleInput: {
    flex: 1,
    fontFamily: FONT_FAMILY,
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
    paddingVertical: 0,
  },
  contentInput: {
    minHeight: 320,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: FONT_FAMILY,
    fontSize: 16,
    lineHeight: 24,
    color: colors.black,
  },
  categoryBlock: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.zinc50,
  },
})
