import { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import TextField from '@/components/ui/TextField'
import BackHeader from '@/components/BackHeader'
import Markdown from '@/components/Markdown'
import ImageLightbox from '@/components/ImageLightbox'
import { Avatar } from '@/components/PostImage'
import Comment from '@/components/community/Comment'
import PostItem from '@/components/community/PostItem'
import { colors, PAGE_X, radius } from '@/constants/theme'
import {
  addLike,
  canViewPost,
  COMMUNITY_PAGE_SIZE,
  createComment,
  deleteComment,
  deletePost,
  fetchAllPages,
  filterByRegion,
  getComments,
  getPost,
  getPostsByCategory,
  isCommunityCategory,
  parseRegion,
  removeLike,
  sortByLatest,
  updateComment,
} from '@/lib/community'
import { ApiError } from '@/lib/apiError'
import { formatLocaleDate, formatLocaleDateTime } from '@/lib/date'
import { confirm } from '@/lib/dialog'
import { formatNumber } from '@/lib/http'
import { signinHref } from '@/lib/navigation'
import { useMyLocation } from '@/hooks/useMyLocation'
import { useHandleError } from '@/hooks/useHandleError'
import { useAuthStore, decodeJwtUsername } from '@/store/authStore'
import { useLikeStore } from '@/store/likeStore'

interface Post {
  id: number
  username: string
  // 프로필 미설정 회원은 null 로 온다
  imageUrl?: string | null
  title: string
  content: string
  category?: string
  fileUrl?: string
  viewCount: number
  likeCount: number
  commentCount: number
  updatedAt: string
  edited: boolean
  isLiked?: boolean
}

interface PostListItem {
  id: number
  username: string
  title: string
  content: string
  category?: string
  fileUrl?: string
  updatedAt: string
}

interface CommentData {
  id: number
  username: string
  content: string
  updatedAt: string
  edited?: boolean
  imageUrl?: string | null
}

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const postId = Number(id)
  const pathname = usePathname()
  const token = useAuthStore((s) => s.accessToken)
  const myUsername = useAuthStore((s) => s.username ?? (s.accessToken ? decodeJwtUsername(s.accessToken) : null))
  const handleError = useHandleError()
  const { location, loaded: locationLoaded } = useMyLocation()
  const myCtprvnCd = location?.ctprvnCd ?? null
  const likeStore = useLikeStore()

  const [loaded, setLoaded] = useState<{ postId: number; post: Post | null } | null>(null)
  const [comments, setComments] = useState<CommentData[]>([])
  const [relatedPosts, setRelatedPosts] = useState<PostListItem[]>([])
  const [commentText, setCommentText] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    if (!postId) return
    try {
      const res = await getComments(postId, token)
      setComments(res.data ?? [])
    } catch {
      setComments([])
    }
  }, [postId, token])

  useEffect(() => {
    if (!locationLoaded || !postId) return
    let cancelled = false
    getPost(postId, token)
      .then((res) => {
        if (cancelled) return
        const data: Post | null = Array.isArray(res.data) ? (res.data.find((p: Post) => p.id === postId) ?? res.data[0]) : res.data
        setLoaded({ postId, post: data ?? null })
        setLikeCount(data?.likeCount ?? 0)
        setIsLiked(data?.isLiked ?? useLikeStore.getState().isLiked(postId))
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) router.replace('/community')
        else setLoaded({ postId, post: null })
      })
    getComments(postId, token)
      .then((res) => {
        if (!cancelled) setComments(res.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setComments([])
      })
    return () => {
      cancelled = true
    }
  }, [postId, token, locationLoaded])

  const post = loaded?.postId === postId ? loaded.post : null
  const postCategory = post?.category ?? null

  // 관련 게시물은 목록과 같은 기준(최신순·지역 필터)으로 같은 카테고리 글을 보여준다
  useEffect(() => {
    if (!locationLoaded || !isCommunityCategory(postCategory)) return
    let cancelled = false
    fetchAllPages<PostListItem>((p, size) => getPostsByCategory(postCategory, token, p, size))
      .then((all) => {
        if (cancelled) return
        const list = sortByLatest(filterByRegion(all, myCtprvnCd, myUsername))
        const index = list.findIndex((p) => p.id === postId)
        // 웹처럼 지금 글이 들어 있는 페이지(10개 단위)만 보여주고 지금 글은 뺀다
        const page = index === -1 ? 0 : Math.floor(index / COMMUNITY_PAGE_SIZE)
        setRelatedPosts(list.slice(page * COMMUNITY_PAGE_SIZE, (page + 1) * COMMUNITY_PAGE_SIZE).filter((p) => p.id !== postId))
      })
      .catch(() => {
        if (!cancelled) setRelatedPosts([])
      })
    return () => {
      cancelled = true
    }
  }, [postId, postCategory, token, myCtprvnCd, myUsername, locationLoaded])

  async function handleLike() {
    if (!token) {
      router.push(signinHref(pathname) as never)
      return
    }
    try {
      if (isLiked) {
        await removeLike(token, postId)
        setIsLiked(false)
        setLikeCount((c) => c - 1)
        likeStore.unlike(postId)
      } else {
        const res = await addLike(token, postId)
        setIsLiked(true)
        likeStore.like(postId)
        if (!(res as { alreadyLiked?: boolean })?.alreadyLiked) setLikeCount((c) => c + 1)
      }
    } catch (e) {
      void handleError(e)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!(await confirm('게시글을 삭제하시겠습니까?', { confirmText: '삭제', destructive: true }))) return
    try {
      await deletePost(token, postId)
      router.replace('/community')
    } catch (e) {
      void handleError(e)
    }
  }

  async function handleCommentEdit(commentId: number, content: string) {
    if (!token) return
    try {
      await updateComment(token, commentId, content)
      await fetchComments()
    } catch (e) {
      void handleError(e)
    }
  }

  async function handleCommentDelete(commentId: number) {
    if (!token) return
    if (!(await confirm('댓글을 삭제하시겠습니까?', { confirmText: '삭제', destructive: true }))) return
    try {
      await deleteComment(token, commentId)
      await fetchComments()
    } catch (e) {
      void handleError(e)
    }
  }

  async function handleCommentSubmit() {
    if (!token) {
      router.push(signinHref(pathname) as never)
      return
    }
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      await createComment(token, postId, commentText)
      setCommentText('')
      await fetchComments()
    } catch (e) {
      void handleError(e)
    } finally {
      setSubmitting(false)
    }
  }

  if (!loaded || loaded.postId !== postId) {
    return (
      <View style={styles.container}>
        <BackHeader fallbackHref="/community" />
        <Text color={colors.zinc400} align="center" style={styles.message}>
          불러오는 중...
        </Text>
      </View>
    )
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <BackHeader fallbackHref="/community" />
        <Text color={colors.zinc400} align="center" style={styles.message}>
          게시글을 불러오지 못했습니다.
        </Text>
      </View>
    )
  }

  // 주소로 직접 들어와도 다른 시·도의 동네 주민 글은 내용을 보여주지 않는다
  if (!canViewPost(post, myCtprvnCd, myUsername)) {
    return (
      <View style={styles.container}>
        <BackHeader fallbackHref="/community" />
        <Text color={colors.zinc400} align="center" style={styles.message}>
          {location ? '같은 지역 주민만 볼 수 있는 글입니다.' : '프로필에서 지역을 설정하면 같은 지역 주민의 글을 볼 수 있습니다.'}
        </Text>
      </View>
    )
  }

  const isOwner = myUsername === post.username

  return (
    <View style={styles.container}>
      <BackHeader
        fallbackHref="/community"
        right={
          isOwner ? (
            <View style={styles.ownerActions}>
              <Button variant="secondary" size="sm" onPress={() => router.push(`/community/write/${postId}`)}>
                수정
              </Button>
              <Button variant="dangerOutline" size="sm" onPress={() => void handleDelete()}>
                삭제
              </Button>
            </View>
          ) : null
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {/* 머리 */}
            <View style={styles.headerBlock}>
              <Text size="2xl" weight="medium">
                {post.title}
              </Text>
              <View style={styles.author}>
                <Avatar uri={post.imageUrl} size={48} style={styles.avatar} />
                <View style={styles.authorTexts}>
                  <Text size="sm" weight="medium">
                    {post.username}
                  </Text>
                  {/* 휴대폰 폭에서는 날짜·조회수·댓글 수가 한 줄에 다 들어가지 않아 항목 단위로 줄을 바꾼다 */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaLeft}>
                      <Text size="sm" weight="medium" color={colors.zinc400}>
                        {formatLocaleDateTime(post.updatedAt)}
                      </Text>
                      <Text size="sm" weight="medium" color={colors.zinc400}>
                        조회 {formatNumber(post.viewCount ?? 0)}
                      </Text>
                      {post.edited ? (
                        <Text size="xs" color={colors.zinc400}>
                          (수정됨)
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.countRow}>
                      <Ionicons name="chatbox-outline" size={18} color={colors.black} />
                      <Text size="sm" weight="semibold" color={colors.zinc500}>
                        댓글
                      </Text>
                      <Text size="sm" weight="semibold">
                        {post.commentCount ?? 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.rule} />

            {/* 본문 */}
            <Markdown source={parseRegion(post.content).body} onImagePress={setLightboxSrc} />
            <View style={styles.reactions}>
              <Pressable onPress={() => void handleLike()} style={styles.countRow} hitSlop={6}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={colors.main} />
                <Text size="sm" weight="semibold" color={colors.zinc500}>
                  좋아요
                </Text>
                <Text size="sm" weight="semibold">
                  {likeCount}
                </Text>
              </Pressable>
              <View style={styles.countRow}>
                <Ionicons name="chatbox-outline" size={20} color={colors.black} />
                <Text size="sm" weight="semibold" color={colors.zinc500}>
                  댓글
                </Text>
                <Text size="sm" weight="semibold">
                  {comments.length}
                </Text>
              </View>
            </View>

            <View style={styles.rule} />

            {/* 댓글 */}
            <View style={styles.comments}>
              {comments.map((c, i) => (
                <View key={c.id} style={i > 0 ? styles.commentDivider : undefined}>
                  <Comment
                    authorName={c.username}
                    profileImage={c.imageUrl}
                    content={c.content}
                    edited={c.edited}
                    isOwner={myUsername === c.username}
                    onEdit={(content) => handleCommentEdit(c.id, content)}
                    onDelete={() => handleCommentDelete(c.id)}
                    createdAt={formatLocaleDateTime(c.updatedAt)}
                  />
                </View>
              ))}
              <View style={styles.composer}>
                <Text weight="bold">{token ? '댓글 작성' : '로그인 후 댓글을 작성할 수 있습니다'}</Text>
                <TextField
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="댓글을 입력하세요..."
                  multiline
                  editable={!!token}
                  containerStyle={styles.commentInput}
                />
                <View style={styles.submitRow}>
                  <Button loading={submitting} disabled={!token} onPress={() => void handleCommentSubmit()}>
                    {submitting ? '등록 중...' : '등록'}
                  </Button>
                </View>
              </View>
            </View>
          </View>

          {/* 관련 게시물 */}
          {relatedPosts.length > 0 ? (
            <View style={styles.related}>
              <Text size="xl" weight="bold">
                관련 게시물
              </Text>
              <View>
                {relatedPosts.map((p, i) => (
                  <View key={p.id} style={i > 0 ? styles.relatedDivider : undefined}>
                    <PostItem id={p.id} title={p.title} content={p.content} imageUrl={p.fileUrl} createdAt={formatLocaleDate(p.updatedAt)} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  message: { paddingVertical: 80, paddingHorizontal: PAGE_X },
  content: { padding: PAGE_X, gap: 32, paddingBottom: 48 },
  ownerActions: { flexDirection: 'row', gap: 8 },
  card: {
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  headerBlock: { gap: 12 },
  author: { flexDirection: 'row', gap: 8 },
  avatar: { borderWidth: 1, borderColor: colors.line },
  authorTexts: { flex: 1, justifyContent: 'center', gap: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 12, rowGap: 4 },
  metaLeft: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rule: { height: 1, backgroundColor: colors.zinc300 },
  reactions: { flexDirection: 'row', gap: 16 },
  comments: { gap: 8 },
  commentDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  composer: {
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  commentInput: { minHeight: 96 },
  submitRow: { alignItems: 'flex-end' },
  related: { gap: 8 },
  relatedDivider: { borderTopWidth: 1, borderTopColor: colors.line },
})
