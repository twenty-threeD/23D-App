import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import BackHeader from '@/components/BackHeader'
import Pagination from '@/components/Pagination'
import { colors, PAGE_X, radius } from '@/constants/theme'
import { subscribeRecentActivity, truncateAddress, truncatePaymentId, type RecentActivity } from '@/lib/chain'
import { formatRelativeTime, useNow } from '@/lib/relativeTime'
import { display } from '@/lib/display'

/** 한 페이지에 보여줄 행 수 */
const PAGE_SIZE = 10

export default function Page() {
  // 시안은 '최근 블록'만 있지만, 트랜잭션도 같은 틀로 보여주려고 파라미터로 구분한다
  const params = useLocalSearchParams<{ type?: string; height?: string }>()
  const isTransactions = params.type === 'transactions'
  // 블록을 눌러 들어오면 그 높이의 트랜잭션만 보여준다
  const blockHeight = isTransactions && params.height != null && Number.isFinite(Number(params.height)) ? Number(params.height) : null
  // undefined 는 아직 첫 응답 전(스켈레톤), null 은 받기 실패로 구분한다. 실패를 스켈레톤으로 두면 끝없이 불러오는 것처럼 보인다
  const [activity, setActivity] = useState<RecentActivity | null | undefined>(undefined)
  const [page, setPage] = useState(1)

  useEffect(() => subscribeRecentActivity({ onActivity: setActivity, onError: () => setActivity(null) }), [])

  const blocks = activity?.blocks ?? []
  // 노드가 블록별 조회를 따로 주지 않아, 이미 받아온 최근 트랜잭션에서 높이로 거른다
  const transactions = (activity?.transactions ?? []).filter((tx) => blockHeight === null || tx.height === blockHeight)
  const now = useNow(blocks.map((block) => block.time))

  const rowCount = isTransactions ? transactions.length : blocks.length
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE))
  // 폴링 사이에 기록 수가 줄어도 빈 페이지가 보이지 않게 마지막 페이지로 붙인다
  const current = Math.min(page, totalPages)
  const start = (current - 1) * PAGE_SIZE

  const title = blockHeight !== null ? `블록 ${blockHeight}에 포함된 트랜잭션` : isTransactions ? '최근 트랜잭션' : '최근 블록'

  return (
    <View style={styles.container}>
      <BackHeader title={title} fallbackHref="/blockchain" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text size="sm" color={colors.placeholder} style={styles.first}>
              {isTransactions ? '트랜잭션 해시' : '블록높이'}
            </Text>
            <Text size="sm" color={colors.placeholder} align="right" style={styles.cell}>
              {isTransactions ? '서명자' : '시간'}
            </Text>
            <Text size="sm" color={colors.placeholder} align="right" style={styles.cell}>
              {isTransactions ? '결제 ID' : 'TX 수'}
            </Text>
          </View>
          {activity === undefined ? (
            Array.from({ length: PAGE_SIZE }, (_, i) => (
              <View key={i} style={styles.row}>
                <View style={styles.first}>
                  <Skeleton width={isTransactions ? '80%' : 72} height={24} />
                </View>
                <View style={[styles.cell, styles.cellEnd]}>
                  <Skeleton width={56} height={20} />
                </View>
                <View style={[styles.cell, styles.cellEnd]}>
                  <Skeleton width={48} height={20} />
                </View>
              </View>
            ))
          ) : activity === null ? (
            <Text size="sm" color={colors.placeholder} align="center" style={styles.message}>
              기록을 불러오지 못했어요
            </Text>
          ) : rowCount === 0 ? (
            <Text size="sm" color={colors.placeholder} align="center" style={styles.message}>
              {blockHeight !== null ? '최근 기록에서 이 블록의 트랜잭션을 찾을 수 없어요' : '아직 기록이 없어요'}
            </Text>
          ) : isTransactions ? (
            transactions.slice(start, start + PAGE_SIZE).map((tx) => (
              <View key={tx.hash} style={styles.row}>
                <Pressable onPress={() => router.push({ pathname: '/blockchain/detail/[hash]', params: { hash: tx.hash } })} style={styles.first}>
                  <Text weight="medium" numberOfLines={1} ellipsizeMode="middle">
                    {tx.hash}
                  </Text>
                </Pressable>
                <Text size="sm" weight="medium" align="right" numberOfLines={1} style={styles.cell}>
                  {display(truncateAddress(tx.signer))}
                </Text>
                <Text size="sm" weight="medium" align="right" numberOfLines={1} style={styles.cell}>
                  {display(truncatePaymentId(tx.paymentId))}
                </Text>
              </View>
            ))
          ) : (
            blocks.slice(start, start + PAGE_SIZE).map((block) => (
              <View key={block.height} style={styles.row}>
                <Pressable
                  onPress={() => router.push({ pathname: '/blockchain/more', params: { type: 'transactions', height: String(block.height) } })}
                  style={styles.first}
                >
                  <Text weight="medium">{block.height}</Text>
                </Pressable>
                <Text size="sm" weight="medium" align="right" style={styles.cell}>
                  {display(formatRelativeTime(block.time, now))}
                </Text>
                <Text size="sm" weight="medium" align="right" style={styles.cell}>
                  {block.txCount} tx
                </Text>
              </View>
            ))
          )}
        </View>
        <Pagination page={current} totalPages={totalPages} onChange={setPage} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: PAGE_X, paddingBottom: 40 },
  card: { gap: 24, padding: 20, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  first: { flex: 2, minWidth: 0 },
  cell: { flex: 1, minWidth: 0 },
  cellEnd: { alignItems: 'flex-end' },
  message: { paddingVertical: 24 },
})
