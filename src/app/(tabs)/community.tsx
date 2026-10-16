import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams, usePathname } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import TopButton from '@/components/TopButton'
import CategoryTabs from '@/components/community/CategoryTabs'
import PostItem, { PostItemSkeleton } from '@/components/community/PostItem'
import { colors, FONT_FAMILY, PAGE_X, radius } from '@/constants/theme'
import {
  categoryLabel,
  fetchAllPages,
  filterByRegion,
  getPosts,
  getPostsByCategory,
  isCommunityCategory,
  needsRegionFilter,
  searchPosts,
  sortByLatest,
  type CommunityCategory,
} from '@/lib/community'
import { invalidate } from '@/lib/cache'
import { formatLocaleDate } from '@/lib/date'
import { signinHref } from '@/lib/navigation'
import { useMyLocation } from '@/hooks/useMyLocation'
import { useAuthStore } from '@/store/authStore'

interface Post {
  id: number
  username: string
  title: string
  content: string
  category?: string
  fileUrl?: string
  updatedAt: string
}

interface Result {
  key: string
  posts: Post[]
  page: number
  last: boolean
}

export default function Page() {
  const params = useLocalSearchParams<{ category?: string }>()
  const category = isCommunityCategory(params.category) ? params.category : null
  const pathname = usePathname()
  const token = useAuthStore((s) => s.accessToken)
  const myUsername = useAuthStore((s) => s.username)
  const { location, loaded: locationLoaded } = useMyLocation()
  const listRef = useRef<FlatList<Post | number>>(null)

  const [keyword, setKeyword] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [showTop, setShowTop] = useState(false)

  // 동네 주민 글이 섞이는 목록(전체·검색·동네 주민)은 작성자 지역을 서버가 몰라 끝까지 받아 거른다.
  // 나머지 카테고리는 서버 페이지를 그대로 이어 받는다(웹과 같은 기준)
  const clientPaging = needsRegionFilter(category, keyword)
  // 같은 목록(카테고리·검색어·지역)을 다시 받을 때는 자리표시자 없이 기존 목록을 둔 채 갈아 끼운다
  const queryKey = `${category ?? ''}|${keyword}|${location?.ctprvnCd ?? ''}|${myUsername ?? ''}`
  const loading = !locationLoaded || result?.key !== queryKey
  const posts = loading ? [] : result.posts

  useEffect(() => {
    if (!locationLoaded) return
    let cancelled = false
    ;(async () => {
      try {
        if (clientPaging) {
          const all = await fetchAllPages<Post>((p, size) =>
            keyword ? searchPosts(keyword, token, p, size) : category ? getPostsByCategory(category, token, p, size) : getPosts(token, p, size),
          )
          if (!cancelled) setResult({ key: queryKey, posts: sortByLatest(filterByRegion(all, location?.ctprvnCd ?? null, myUsername)), page: 0, last: true })
        } else if (category) {
          const res = await getPostsByCategory(category, token, 0)
          if (!cancelled) setResult({ key: queryKey, posts: res.data?.content ?? [], page: 0, last: res.data?.last ?? true })
        }
      } catch {
        if (!cancelled) setResult({ key: queryKey, posts: [], page: 0, last: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientPaging, category, keyword, token, location, myUsername, locationLoaded, queryKey, reloadKey])

  // 글을 쓰고 돌아오면 목록이 바뀌어 있을 수 있다. 목록 캐시는 글쓰기·수정 때 비워지므로 다시 받기만 하면 된다.
  // 처음 열 때는 위 effect 가 이미 받으므로 다시 보일 때만 부른다
  const focusedOnce = useRef(false)
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) setReloadKey((k) => k + 1)
      focusedOnce.current = true
    }, []),
  )

  async function handleLoadMore() {
    if (loading || result.last || loadingMore || !category) return
    const requestedKey = queryKey
    setLoadingMore(true)
    try {
      const res = await getPostsByCategory(category, token, result.page + 1)
      setResult((prev) =>
        prev && prev.key === requestedKey
          ? { ...prev, posts: [...prev.posts, ...(res.data?.content ?? [])], page: prev.page + 1, last: res.data?.last ?? true }
          : prev,
      )
    } catch {
      setResult((prev) => (prev && prev.key === requestedKey ? { ...prev, last: true } : prev))
    } finally {
      setLoadingMore(false)
    }
  }

  function selectCategory(next: CommunityCategory | null) {
    // 카테고리를 바꾸면 검색어는 초기화
    setKeyword('')
    setSearchValue('')
    router.setParams({ category: next ?? '' })
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  function handleRefresh() {
    invalidate('community:')
    setReloadKey((k) => k + 1)
  }

  const emptyMessage =
    category === 'NEIGHBORHOOD' && !location
      ? '프로필에서 지역을 설정하면 같은 지역 주민의 글을 볼 수 있습니다.'
      : category === 'NEIGHBORHOOD'
        ? `'${location!.locationName.split(' ')[0]}' 주민 게시글이 없습니다.`
        : category
          ? `'${categoryLabel(category)}' 게시글이 없습니다.`
          : '게시글이 없습니다.'

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text size="xl" weight="semibold">
          커뮤니티
        </Text>
      </View>
      <CategoryTabs value={category} onChange={selectCategory} />
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Pressable onPress={() => setKeyword(searchValue.trim())} hitSlop={6} accessibilityLabel="검색">
            <Ionicons name="search" size={22} color={colors.zinc500} />
          </Pressable>
          <TextInput
            value={searchValue}
            onChangeText={setSearchValue}
            onSubmitEditing={() => setKeyword(searchValue.trim())}
            placeholder="검색어를 입력해주세요"
            placeholderTextColor={colors.zinc400}
            returnKeyType="search"
            selectionColor={colors.main}
            cursorColor={colors.main}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={() => router.push(token ? '/community/write' : (signinHref(pathname) as never))}
          style={({ pressed }) => [styles.writeButton, pressed && styles.writePressed]}
        >
          <Text weight="semibold" color={colors.white}>
            글작성
          </Text>
        </Pressable>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={loading ? [0, 1, 2, 3, 4] : posts}
        keyExtractor={(item) => (typeof item === 'number' ? `skeleton-${item}` : String(item.id))}
        renderItem={({ item }) =>
          typeof item === 'number' ? (
            <PostItemSkeleton />
          ) : (
            <PostItem id={item.id} title={item.title} content={item.content} imageUrl={item.fileUrl} createdAt={formatLocaleDate(item.updatedAt)} />
          )
        }
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text color={colors.zinc400} align="center" style={styles.empty}>
            {emptyMessage}
          </Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <Text size="sm" color={colors.inkMuted} align="center" style={styles.footer}>
              불러오는 중...
            </Text>
          ) : null
        }
        contentContainerStyle={styles.content}
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 600)}
        scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} colors={[colors.main]} tintColor={colors.main} />}
      />
      <TopButton visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </View>
  )
}

function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_X,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: { gap: 12, paddingBottom: 8 },
  titleRow: {
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  searchRow: { flexDirection: 'row', gap: 8, paddingTop: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
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
  writeButton: {
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  writePressed: { backgroundColor: colors.mainPressed },
  divider: { height: 1, backgroundColor: colors.line },
  empty: { paddingVertical: 32 },
  footer: { paddingTop: 24 },
})
