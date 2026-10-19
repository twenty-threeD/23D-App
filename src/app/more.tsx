import { useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import TopButton from '@/components/TopButton'
import ServiceCard, { ServiceCardSkeleton } from '@/components/main/ServiceCard'
import type { MoreSection } from '@/components/main/ServiceSection'
import { colors, PAGE_X } from '@/constants/theme'
import { getPostCategories, POPULAR_SORT, REVISIT_SORT, searchPostsPaged, type Post, type PostCategory } from '@/lib/post'
import { formatNumber } from '@/lib/http'

// 웹은 인기순·최신순 둘뿐이다. 앱은 '재방문율이 높아요' 더보기로 들어오면 메인 줄과 같은 순서로 보이도록 재방문순을 더한다
const SORT_OPTIONS = [
  { label: '인기순', value: POPULAR_SORT },
  { label: '재방문순', value: REVISIT_SORT },
  { label: '최신순', value: 'updatedAt,desc' },
] as const

// 메인에서 더보기를 누른 줄의 제목과 정렬로 연다. 목록 자체는 같은 전체 서비스 목록이다
const SECTIONS: Record<MoreSection, { title: string; description: string; sort: string }> = {
  ad: { title: '광고', description: '잇다가 소개하는 능력자들을 모아봤어요.', sort: POPULAR_SORT },
  popular: { title: '이웃들이\n많이 찾아요', description: '지금 이웃들이 관심 있게 보고 있는 능력자들을 모아봤어요.', sort: POPULAR_SORT },
  revisit: { title: '재방문율이\n높아요', description: '이웃들이 다시 찾는 능력자들을 모아봤어요.', sort: REVISIT_SORT },
}

const PAGE_SIZE = 20
const COLUMN_GAP = 12

export default function Page() {
  const params = useLocalSearchParams<{ categoryId?: string; sort?: string; section?: string }>()
  const section = SECTIONS[params.section as MoreSection] ?? SECTIONS.popular
  const categoryId = params.categoryId || null
  const sort = params.sort || section.sort
  const { width } = useWindowDimensions()
  const listRef = useRef<FlatList<Post | number>>(null)

  const [categories, setCategories] = useState<PostCategory[]>([])
  // 어떤 조건으로 받은 결과인지 같이 들고, 지금 조건과 다르면 불러오는 중으로 본다 (effect 안에서 setState 를 먼저 부르지 않기 위함)
  const [result, setResult] = useState<{ key: string; posts: Post[]; total: number; page: number; last: boolean } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const [showTop, setShowTop] = useState(false)

  const queryKey = `${categoryId ?? ''}|${sort}`
  const loading = result?.key !== queryKey
  const posts = loading ? [] : result.posts
  const total = loading ? 0 : result.total
  const isLast = loading ? true : result.last

  useEffect(() => {
    getPostCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    searchPostsPaged({ categoryId: categoryId ? Number(categoryId) : undefined, sort, page: 0, size: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setResult({ key: queryKey, posts: res.posts, total: res.totalElements, page: res.page, last: res.last })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: queryKey, posts: [], total: 0, page: 0, last: true })
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, sort, queryKey])

  function updateQuery(next: { categoryId?: string; sort?: string }) {
    router.setParams({ categoryId: next.categoryId ?? categoryId ?? '', sort: next.sort ?? sort })
  }

  // 웹은 '더 보기' 버튼으로 다음 페이지를 받지만, 앱은 검색 화면처럼 목록 끝에 가까워지면 이어 붙인다
  async function handleLoadMore() {
    // 스크롤로 자동으로 부르므로 같은 페이지를 겹쳐 부르지 않게 막는다. state 는 다음 렌더에야 바뀌어 ref 로 본다
    if (loading || isLast || loadingMoreRef.current) return
    loadingMoreRef.current = true
    const requestedKey = queryKey
    setLoadingMore(true)
    try {
      const res = await searchPostsPaged({ categoryId: categoryId ? Number(categoryId) : undefined, sort, page: result.page + 1, size: PAGE_SIZE })
      setResult((prev) =>
        prev && prev.key === requestedKey ? { ...prev, posts: [...prev.posts, ...res.posts], page: res.page, last: res.last } : prev,
      )
    } catch {
      setResult((prev) => (prev && prev.key === requestedKey ? { ...prev, last: true } : prev))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  const columnWidth = (width - PAGE_X * 2 - COLUMN_GAP) / 2
  const data: (Post | number)[] = loading ? Array.from({ length: 6 }, (_, i) => i) : posts

  const chip = (label: string, active: boolean, onPress: () => void, key: string) => (
    <Pressable key={key} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text size="sm" color={active ? colors.white : colors.zinc500}>
        {label}
      </Text>
    </Pressable>
  )

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text size="3xl" weight="bold">
          {section.title}
        </Text>
        <Text color={colors.zinc500}>{section.description}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.chips}>
        {chip('전체', !categoryId, () => updateQuery({ categoryId: '' }), 'all')}
        {categories.map((category) =>
          chip(category.name, categoryId === String(category.id), () => updateQuery({ categoryId: String(category.id) }), String(category.id)),
        )}
      </View>
      <View style={styles.summary}>
        <Text size="sm" color={colors.zinc500}>
          {categoryId ? '선택한 카테고리 ' : '전체 서비스 '}
          <Text size="sm" weight="semibold" color={colors.zinc800}>
            {formatNumber(total)}
          </Text>
          건
        </Text>
        <View style={styles.sorts}>
          {SORT_OPTIONS.map((option) => (
            <Pressable key={option.value} onPress={() => updateQuery({ sort: option.value })} hitSlop={6}>
              <Text
                size="sm"
                weight={sort === option.value ? 'semibold' : 'regular'}
                color={sort === option.value ? colors.main : colors.zinc400}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <BackHeader />
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
            <Text color={colors.zinc500}>아직 등록된 서비스가 없습니다.</Text>
            <Text size="sm" color={colors.zinc400}>
              다른 카테고리를 선택해 다시 찾아보세요.
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
        onEndReached={() => void handleLoadMore()}
        onEndReachedThreshold={0.6}
        contentContainerStyle={styles.content}
        onScroll={(e) => setShowTop(e.nativeEvent.contentOffset.y > 600)}
        scrollEventThrottle={100}
      />
      <TopButton visible={showTop} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </View>
  )
}

function RowGap() {
  return <View style={styles.rowGap} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: {
    paddingHorizontal: PAGE_X,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    gap: 24,
    paddingBottom: 24,
  },
  titleBlock: {
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.main,
    borderColor: colors.main,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  sorts: {
    flexDirection: 'row',
    gap: 12,
  },
  row: { gap: COLUMN_GAP },
  rowGap: { height: 32 },
  empty: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    paddingTop: 32,
    alignItems: 'center',
  },
})
