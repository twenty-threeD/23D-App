import { useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import SearchBar from '@/components/SearchBar'
import CardRow from '@/components/main/CardRow'
import AdCard, { AdCardSkeleton } from '@/components/main/AdCard'
import ServiceSection, { Empty, MoreLink } from '@/components/main/ServiceSection'
import Footer from '@/components/main/Footer'
import { colors, PAGE_X } from '@/constants/theme'
import { CATEGORIES, getPostCategories, getPosts, getRankedPosts, POPULAR_SORT, REVISIT_SORT, type Post, type PostCategory } from '@/lib/post'
import { invalidate } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'

const CHIP_GAP = 8
const AD_GAP = 26

export default function Page() {
  const token = useAuthStore((s) => s.accessToken)
  const { width } = useWindowDimensions()
  const [searchValue, setSearchValue] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [popularPosts, setPopularPosts] = useState<Post[]>([])
  const [revisitPosts, setRevisitPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [categories, setCategories] = useState<PostCategory[]>([])

  useEffect(() => {
    getPostCategories().then(setCategories).catch(() => {})
  }, [])

  // 당겨서 새로고침하면 올려서 다시 받는다
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // 줄마다 따로 받아 한 줄이 실패해도 나머지는 보여준다
    const empty = () => [] as Post[]
    Promise.all([
      getPosts(token).catch(empty),
      getRankedPosts(POPULAR_SORT).catch(empty),
      getRankedPosts(REVISIT_SORT).catch(empty),
    ])
      .then(([list, popular, revisit]) => {
        if (cancelled) return
        setPosts(list)
        setPopularPosts(popular)
        setRevisitPosts(revisit)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setRefreshing(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, reloadKey])

  // 앱은 새로고침 버튼이 없어 당겨서 새로고침으로 대신한다. 캐시를 버려야 실제로 다시 받는다
  function handleRefresh() {
    setRefreshing(true)
    invalidate('post:')
    setReloadKey((k) => k + 1)
  }

  // 카테고리 목록을 서버 응답 뒤에 그리면 처음엔 비어 보여서 고정 목록을 바로 그리고,
  // 서버 id 는 누르는 시점에 찾는다. 응답 전에 눌리면 그 자리에서 한 번 더 받아온다
  async function openCategory(name: string) {
    const list = categories.length > 0 ? categories : await getPostCategories().catch(() => [])
    const match = list.find((c) => c.name === name)
    router.navigate({ pathname: '/search', params: { keyword: '', categoryId: match ? String(match.id) : '', sort: '' } })
  }

  function handleSearch() {
    router.navigate({ pathname: '/search', params: { keyword: searchValue.trim(), categoryId: '', sort: '' } })
  }

  // 카드가 화면 오른쪽 밖으로 이어져야 넘길 거리가 생긴다. 줄마다 넉넉히 채운다(웹과 같은 규칙)
  // 광고는 서버에 광고 API 가 없어 웹처럼 전체 목록 앞쪽을 쓴다
  const adPosts = posts.slice(0, 8)

  const adWidth = Math.min(360, Math.round(width * 0.85))
  const chipWidth = (width - PAGE_X * 2 - CHIP_GAP * 3) / 4

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.main]} tintColor={colors.main} />}
    >
      {/* 검색 + 카테고리 */}
      <View style={styles.hero}>
        <Text size="xl" weight="semibold" color={colors.ink} align="center" style={styles.headline}>
          블록체인 기반 용역 중개 플랫폼,{' '}
          <Text size="2xl" weight="bold" color={colors.main}>
            잇다
          </Text>
          에서{'\n'}필요한 순간, 필요한 능력자를 만나보세요.
        </Text>
        <View style={styles.searchArea}>
          <SearchBar
            value={searchValue}
            onChangeText={setSearchValue}
            onSubmit={handleSearch}
            // 웹 문구(자동차 래핑, 에어컨 설치, 이사 인테리어... 어떤걸 찾고 있나요?)는 휴대폰 너비에 안 들어가
            // 안드로이드에서 안내 문구가 두 줄로 꺾이며 아래가 잘린다. 한 줄에 들어가는 짧은 문구로 바꿨다
            placeholder="에어컨 설치, 이사 청소... 무엇을 찾나요?"
          />
          {/* 칩 너비가 글자 수마다 달라 들쭉날쭉하게 끊기지 않도록 8개를 같은 너비 4칸 × 2줄로 맞춘다(웹 모바일) */}
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.label}
                onPress={() => void openCategory(c.name)}
                style={({ pressed }) => [styles.chip, { width: chipWidth }, pressed && styles.chipPressed]}
              >
                {({ pressed }) => (
                  <Text weight="semibold" color={pressed ? colors.main : colors.inkHint} numberOfLines={1} style={styles.chipText}>
                    {c.label}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* 광고 */}
      <View style={styles.section}>
        <View style={styles.adTitle}>
          <Text size="2xl" weight="semibold" color={colors.ink}>
            광고
          </Text>
          <MoreLink section="ad" />
        </View>
        {loading ? (
          <CardRow itemWidth={adWidth} gap={AD_GAP}>
            {Array.from({ length: 2 }).map((_, i) => (
              <AdCardSkeleton key={i} width={adWidth} />
            ))}
          </CardRow>
        ) : adPosts.length > 0 ? (
          <CardRow itemWidth={adWidth} gap={AD_GAP} autoSlideMs={5000} snap loop={adPosts.length > 1}>
            {adPosts.map((post) => (
              <AdCard key={post.id} post={post} width={adWidth} />
            ))}
          </CardRow>
        ) : (
          <View style={styles.inset}>
            <Empty />
          </View>
        )}
      </View>

      <ServiceSection title="이웃들이 많이 찾아요" section="popular" loading={loading} posts={popularPosts} />
      <ServiceSection title="재방문율이 높아요" section="revisit" loading={loading} posts={revisitPosts} />

      <Footer />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // 아래 여백은 푸터가 자기 안쪽 여백으로 끝낸다
  content: {
    gap: 56,
    paddingTop: 32,
  },
  hero: {
    gap: 36,
    paddingHorizontal: PAGE_X,
  },
  headline: {
    lineHeight: 30,
  },
  searchArea: {
    gap: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
  },
  chip: {
    paddingVertical: 10,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  chipPressed: {
    borderColor: colors.main,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 16,
  },
  section: {
    gap: 20,
  },
  adTitle: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: PAGE_X,
  },
  inset: {
    paddingHorizontal: PAGE_X,
  },
})
