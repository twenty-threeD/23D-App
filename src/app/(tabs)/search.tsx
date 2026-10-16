import { useEffect, useRef, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Text from '@/components/ui/Text'
import Select from '@/components/ui/Select'
import SearchBar from '@/components/SearchBar'
import TopButton from '@/components/TopButton'
import ServiceCard, { ServiceCardSkeleton } from '@/components/main/ServiceCard'
import { colors, PAGE_X } from '@/constants/theme'
import { CATEGORIES, getPostCategories, searchPostsPaged, type Post, type PostCategory } from '@/lib/post'
import { invalidate } from '@/lib/cache'
import { formatNumber } from '@/lib/http'

const SORT_OPTIONS = [
  { label: '최신순', value: 'updatedAt,desc' },
  { label: '조회순', value: 'viewCount,desc' },
] as const

const PAGE_SIZE = 20
const COLUMN_GAP = 12

type Params = { keyword?: string; categoryId?: string; sort?: string }

interface Result {
  // 이 결과가 어떤 조건으로 받은 것인지. 지금 조건과 다르면 아직 불러오는 중이다
  key: string
  posts: Post[]
  total: number
  page: number
  last: boolean
}

export default function Page() {
  const params = useLocalSearchParams<Params>()
  const keyword = params.keyword ?? ''
  const categoryId = params.categoryId || null
  const sort = params.sort || SORT_OPTIONS[0].value
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<Post | number>>(null)

  const [categories, setCategories] = useState<PostCategory[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showTop, setShowTop] = useState(false)
  // 당겨서 새로고침하면 올려서 첫 페이지를 다시 받게 한다
  const [reloadKey, setReloadKey] = useState(0)

  const [searchValue, setSearchValue] = useState(keyword)
  const [syncedKeyword, setSyncedKeyword] = useState(keyword)
  // 다른 화면에서 검색어를 들고 들어오면 입력창도 따라가게 한다.
  // effect 로 맞추면 한 번 더 렌더되므로 렌더 중에 이전 값과 비교해 바로 맞춘다(웹과 같다)
  if (syncedKeyword !== keyword) {
    setSyncedKeyword(keyword)
    setSearchValue(keyword)
  }

  const queryKey = `${keyword}|${categoryId ?? ''}|${sort}|${reloadKey}`
  // 로딩 여부를 따로 들지 않고 결과의 조건과 비교해 파생시킨다 (effect 안에서 setState 를 먼저 부르지 않기 위함)
  const loading = result?.key !== queryKey
  const posts = loading ? [] : result.posts

  // 다음 페이지를 받는 사이 검색 조건이 바뀌면, 이전 조건의 결과를 새 목록 뒤에 붙이지 않는다
  const queryKeyRef = useRef(queryKey)
  const loadingMoreRef = useRef(false)
  useEffect(() => {
    queryKeyRef.current = queryKey
  }, [queryKey])

  useEffect(() => {
    getPostCategories().then(setCategories).catch(() => {})
  }, [])

  // 조건이 바뀌면 첫 페이지부터 다시 불러온다
  useEffect(() => {
    let cancelled = false
    searchPostsPaged({ title: keyword, categoryId: categoryId ? Number(categoryId) : undefined, sort, page: 0, size: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setResult({ key: queryKey, posts: res.posts, total: res.totalElements, page: res.page, last: res.last })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: queryKey, posts: [], total: 0, page: 0, last: true })
      })
    return () => {
      cancelled = true
    }
  }, [keyword, categoryId, sort, queryKey])

  // 검색 조건은 화면 파라미터에 둔다. 다른 화면에서 카테고리·검색어를 들고 들어올 때와 같은 길을 쓴다
  function updateQuery(next: Params) {
    router.setParams({
      keyword: next.keyword ?? keyword,
      categoryId: next.categoryId !== undefined ? next.categoryId : (categoryId ?? ''),
      sort: next.sort ?? sort,
    })
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  // 카테고리 목록은 고정 목록으로 바로 그리고, 서버 id 는 고르는 시점에 찾는다. 응답 전에 고르면 그 자리에서 한 번 더 받는다
  async function selectCategory(name: string) {
    if (!name) return updateQuery({ categoryId: '' })
    const list = categories.length > 0 ? categories : await getPostCategories().catch(() => [])
    const id = list.find((category) => category.name === name)?.id
    updateQuery({ categoryId: id !== undefined ? String(id) : '' })
  }

  async function handleLoadMore() {
    // 스크롤로 자동으로 부르므로 같은 페이지를 겹쳐 부르지 않게 막는다. state 는 다음 렌더에야 바뀌어 ref 로 본다
    if (loading || result.last || loadingMoreRef.current) return
    loadingMoreRef.current = true
    const requestedKey = queryKey
    setLoadingMore(true)
    try {
      const res = await searchPostsPaged({
        title: keyword,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sort,
        page: result.page + 1,
        size: PAGE_SIZE,
      })
      if (queryKeyRef.current !== requestedKey) return
      setResult((prev) =>
        prev && prev.key === requestedKey ? { ...prev, posts: [...prev.posts, ...res.posts], page: res.page, last: res.last } : prev,
      )
    } catch {
      // 실패한 채로 두면 끝에 닿을 때마다 같은 요청을 끝없이 반복하므로 더 부르지 않는다
      setResult((prev) => (prev && prev.key === requestedKey ? { ...prev, last: true } : prev))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  function handleRefresh() {
    // 검색 결과는 잠깐 캐시되므로 버려야 실제로 다시 받는다
    invalidate('post:')
    setReloadKey((k) => k + 1)
  }

  const selectedCategoryName = categories.find((c) => String(c.id) === categoryId)?.name ?? ''
  const columnWidth = (width - PAGE_X * 2 - COLUMN_GAP) / 2
  // 로딩 중에는 같은 크기의 자리표시자를 그려 불러온 뒤 화면이 튀지 않게 한다
  const data: (Post | number)[] = loading ? Array.from({ length: 6 }, (_, i) => i) : posts

  const header = (
    <View style={styles.header}>
      <SearchBar
        value={searchValue}
        onChangeText={setSearchValue}
        onSubmit={() => updateQuery({ keyword: searchValue.trim() })}
        placeholder="어떤 능력자를 찾고 계신가요?"
      />
      {/* 휴대폰에서는 카테고리 칩 아홉 개가 세 줄로 쌓여 결과를 밀어내서, 카테고리·정렬을 고르는 바 하나로 줄인다(웹 모바일) */}
      <View style={styles.filters}>
        <Select
          title="카테고리"
          value={selectedCategoryName}
          options={[{ label: '전체 카테고리', value: '' }, ...CATEGORIES.map((c) => ({ label: c.label, value: c.name }))]}
          onChange={(name) => void selectCategory(name)}
          style={styles.categorySelect}
        />
        <Select
          title="정렬"
          value={sort}
          options={SORT_OPTIONS.map((o) => ({ label: o.label, value: o.value as string }))}
          onChange={(value) => updateQuery({ sort: value })}
          style={styles.sortSelect}
        />
      </View>
      <Text weight="semibold" color={colors.inkHint}>
        {keyword ? <Text weight="semibold" color="#1C1C1C">{`“${keyword}” `}</Text> : null}
        {keyword ? '검색 결과 ' : '전체 '}
        <Text weight="semibold" color="#1C1C1C">
          {formatNumber(loading ? 0 : result.total)}
        </Text>
        건
      </Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => (typeof item === 'number' ? `skeleton-${item}` : String(item.id))}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ItemSeparatorComponent={RowGap}
        renderItem={({ item }) => (
          <View style={{ width: columnWidth }}>
            {typeof item === 'number' ? <ServiceCardSkeleton inGrid /> : <ServiceCard post={item} inGrid />}
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text weight="medium" color={colors.inkSub}>
              검색 결과가 없습니다.
            </Text>
            <Text size="sm" color={colors.inkMuted}>
              다른 검색어나 카테고리로 찾아보세요.
            </Text>
          </View>
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
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 600)}
        scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} colors={[colors.main]} tintColor={colors.main} />}
      />
      <TopButton visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </View>
  )
}

function RowGap() {
  return <View style={styles.rowGap} />
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: PAGE_X,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    gap: 24,
    paddingBottom: 24,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  categorySelect: { flex: 1, minHeight: 40 },
  sortSelect: { width: 112, minHeight: 40 },
  row: { gap: COLUMN_GAP },
  rowGap: { height: 40 },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    paddingTop: 24,
  },
})
