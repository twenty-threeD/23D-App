import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import ChainSearchInput from '@/components/blockchain/ChainSearchInput'
import BlockHeightCounter from '@/components/blockchain/BlockHeightCounter'
import HelpTooltip from '@/components/blockchain/HelpTooltip'
import { colors, PAGE_X, radius } from '@/constants/theme'
import {
  formatBlockTime,
  subscribeBlockHeight,
  subscribeNetworkInfo,
  subscribeRecentActivity,
  truncateHash,
  truncatePaymentId,
  type NetworkInfo,
  type RecentActivity,
} from '@/lib/chain'
import { formatRelativeTime, useNow } from '@/lib/relativeTime'
import { display, EMPTY } from '@/lib/display'

/** 카드마다 보여줄 행 수. 데이터가 모자라면 '-' 행으로 채워 카드 높이를 고정한다 */
const ROW_LIMIT = 5

type Cells = [ReactNode, ReactNode]

function CardTitle({ icon, children, help, onMore }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; children: string; help: string; onMore?: () => void }) {
  return (
    <View style={styles.cardTitle}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.main} />
      <View style={styles.titleWithHelp}>
        <Text size="xl" weight="medium">
          {children}
        </Text>
        <HelpTooltip title={children}>{help}</HelpTooltip>
      </View>
      {onMore ? (
        <Pressable onPress={onMore} hitSlop={8}>
          <Text size="xs" weight="medium" color={colors.placeholder} style={styles.underline}>
            자세히보기
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function Stat({ label, value, help, loading = false }: { label: string; value: string | number | null; help: string; loading?: boolean }) {
  return (
    <View style={styles.stat}>
      <View style={styles.titleWithHelp}>
        <Text weight="medium" color={colors.placeholder}>
          {label}
        </Text>
        <HelpTooltip title={label}>{help}</HelpTooltip>
      </View>
      {loading ? (
        <Skeleton width={56} height={32} />
      ) : (
        <Text size="2xl" weight="semibold" color={colors.main}>
          {display(value)}
        </Text>
      )}
    </View>
  )
}

// 휴대폰 폭에서는 세 칸이 겹쳐 두 칸만 둔다(웹 모바일: 트랜잭션 표는 서명자, 블록 표는 그대로 세 칸이지만 폭을 맞추려 시간·TX 수를 한 칸에 둔다)
function TableRow({ cells, header = false }: { cells: Cells; header?: boolean }) {
  return (
    <View style={styles.tableRow}>
      <View style={styles.cellLeft}>
        {typeof cells[0] === 'string' ? (
          <Text size={header ? 'sm' : 'base'} color={header ? colors.placeholder : colors.black} numberOfLines={1}>
            {cells[0]}
          </Text>
        ) : (
          cells[0]
        )}
      </View>
      <View style={styles.cellRight}>
        {typeof cells[1] === 'string' ? (
          <Text size="sm" color={header ? colors.placeholder : colors.black} numberOfLines={1} align="right">
            {cells[1]}
          </Text>
        ) : (
          cells[1]
        )}
      </View>
    </View>
  )
}

function padRows(rows: Cells[]): Cells[] {
  return [...rows, ...Array<Cells>(Math.max(0, ROW_LIMIT - rows.length)).fill([EMPTY, EMPTY])]
}

// 처음 받기 전에는 '-' 행 대신 같은 높이의 스켈레톤 행을 채운다. 실패하면 기존처럼 '-' 행으로 남는다
const SKELETON_ROWS = Array.from({ length: ROW_LIMIT }, (): Cells => [<Skeleton key="left" width={96} height={24} />, <Skeleton key="right" width={88} height={20} />])

export default function Page() {
  const [blockHeight, setBlockHeight] = useState<number | null>(null)
  const [heightError, setHeightError] = useState(false)
  // undefined 는 아직 첫 응답 전(스켈레톤), null 은 받기 실패('-')로 구분한다
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null | undefined>(undefined)
  const [activity, setActivity] = useState<RecentActivity | null | undefined>(undefined)

  useEffect(
    () =>
      subscribeBlockHeight({
        onHeight: (height) => {
          setBlockHeight(height)
          setHeightError(false)
        },
        onError: () => setHeightError(true),
      }),
    [],
  )
  useEffect(() => subscribeNetworkInfo({ onInfo: setNetworkInfo, onError: () => setNetworkInfo(null) }), [])
  useEffect(() => subscribeRecentActivity({ onActivity: setActivity, onError: () => setActivity(null) }), [])

  const blocks = (activity?.blocks ?? []).slice(0, ROW_LIMIT)
  const transactions = (activity?.transactions ?? []).slice(0, ROW_LIMIT)
  // 두 카드가 같은 시각을 공유해 타이머 하나로 모든 행이 함께 갱신된다
  const now = useNow(blocks.map((block) => block.time))

  const openTx = (hash: string) => router.push({ pathname: '/blockchain/detail/[hash]', params: { hash } })

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text size="2xl" align="center" style={styles.headline}>
        <Text size="2xl" weight="bold" color={colors.main}>
          블록체인
        </Text>
        <Text size="2xl" weight="medium">
          에 기록된{'\n'}결제기록을 확인해보세요
        </Text>
      </Text>

      <ChainSearchInput onSearch={openTx} />

      <View style={styles.card}>
        <CardTitle
          icon="cube-outline"
          help="블록은 결제 기록을 묶어둔 장부의 한 장이에요. 블록 높이는 지금까지 쌓인 블록의 개수로, 결제가 계속 기록되고 있음을 의미해요."
        >
          블록 높이
        </CardTitle>
        {blockHeight === null && !heightError ? (
          <Skeleton width={160} height={40} />
        ) : (
          <BlockHeightCounter value={blockHeight !== null && !heightError ? blockHeight : null} />
        )}
      </View>

      <View style={styles.card}>
        <CardTitle icon="lan" help="잇다의 결제 기록을 보관하고 검증하는 블록체인 네트워크의 현재 상태예요. 자세한 건 각 항목별 도움말을 참고해주세요.">
          네트워크 정보
        </CardTitle>
        <View style={styles.stats}>
          <Stat loading={networkInfo === undefined} label="운용 노드" value={networkInfo?.nodes ?? null} help="결제 기록의 사본을 보관하고 있는 컴퓨터의 수예요." />
          <Stat loading={networkInfo === undefined} label="트랜잭션 검증자" value={networkInfo?.validators ?? null} help="새 블록을 만들고 올바른 결제인지 검증하는 노드 수예요." />
          <Stat
            loading={networkInfo === undefined}
            label="평균 블록 생성 시간"
            value={formatBlockTime(networkInfo?.avgBlockTimeSec ?? null)}
            help="새 블록 하나가 만들어지는 데 걸리는 평균 시간이에요."
          />
        </View>
      </View>

      <View style={styles.card}>
        <CardTitle
          icon="cube-outline"
          help="최근 거래를 담아 만들어진 블록들이에요. 각 블록이 언제 만들어졌는지와 몇 건의 거래가 담겨 있는지를 확인할 수 있어요."
          onMore={() => router.push('/blockchain/more')}
        >
          최근 블록
        </CardTitle>
        <View style={styles.table}>
          <TableRow header cells={['블록높이', '시간 · TX 수']} />
          {(activity === undefined ? SKELETON_ROWS : padRows(
            blocks.map((block): Cells => [
              <Pressable
                key={block.height}
                onPress={() => router.push({ pathname: '/blockchain/more', params: { type: 'transactions', height: String(block.height) } })}
              >
                <Text weight="medium">{block.height}</Text>
              </Pressable>,
              `${display(formatRelativeTime(block.time, now))} · ${block.txCount} tx`,
            ]),
          )).map((cells, index) => (
            <TableRow key={blocks[index]?.height ?? `empty-${index}`} cells={cells} />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <CardTitle
          icon="cash-plus"
          help="최근 블록체인에 기록된 거래들이에요. 거래를 하면 각 거래마다 세부 내용을 조회할 수 있는 고유한 트랜잭션 해시가 생겨나요."
          onMore={() => router.push({ pathname: '/blockchain/more', params: { type: 'transactions' } })}
        >
          최근 트랜잭션
        </CardTitle>
        <View style={styles.table}>
          {/* 휴대폰 폭에서는 세 칸이 겹쳐 덜 찾는 서명자 칸을 뺀다(웹 모바일과 같다) */}
          <TableRow header cells={['트랜잭션 해시', '결제 ID']} />
          {(activity === undefined ? SKELETON_ROWS : padRows(
            transactions.map((tx): Cells => [
              <Pressable key={tx.hash} onPress={() => openTx(tx.hash)}>
                <Text weight="medium">{display(truncateHash(tx.hash))}</Text>
              </Pressable>,
              display(truncatePaymentId(tx.paymentId)),
            ]),
          )).map((cells, index) => (
            <TableRow key={transactions[index]?.hash ?? `empty-${index}`} cells={cells} />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: PAGE_X, paddingVertical: 32, gap: 16 },
  headline: { lineHeight: 34, paddingBottom: 16 },
  card: {
    gap: 28,
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceAlt,
  },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleWithHelp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  underline: { textDecorationLine: 'underline' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 36, rowGap: 20 },
  stat: { gap: 12 },
  table: { gap: 16 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cellLeft: { flex: 1, minWidth: 0 },
  cellRight: { flexShrink: 0, alignItems: 'flex-end' },
})
