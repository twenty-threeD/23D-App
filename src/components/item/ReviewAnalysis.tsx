import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'
import Text from '@/components/ui/Text'
import Skeleton from '@/components/ui/Skeleton'
import { colors, radius } from '@/constants/theme'
import { ApiError } from '@/lib/apiError'
import { getReviewAnalysis, type ReviewAnalysis as ReviewAnalysisData } from '@/lib/review'
import { parseDate, formatLocaleDate } from '@/lib/date'
import { SIGNIN_PATH } from '@/lib/navigation'
import { useAuthStore } from '@/store/authStore'

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReviewAnalysisData }
  | { kind: 'analyzing' }
  | { kind: 'notEnough' }
  | { kind: 'failed' }
  | { kind: 'login' }
  | { kind: 'hidden' }

// 409 는 첫 분석이 다른 요청에서 돌고 있다는 뜻이라 잠시 뒤 다시 물어보면 결과가 온다.
// 분석 한 번이 최대 40초라 그보다 넉넉히 기다리고, 그래도 안 끝나면 실패로 보고 멈춘다
const RETRY_DELAY_MS = 5000
const MAX_RETRIES = 12
// 새로 분석할 땐 응답이 수십 초 걸릴 수 있어, 이 시간이 지나도 응답이 없으면 기다리는 이유를 알려준다
const SLOW_HINT_DELAY_MS = 3000

// 시안의 AI 리뷰 요약 카드. 일반 리뷰와 구분되도록 브랜드 오렌지 그라데이션 테두리와 반짝이 아이콘을 쓴다.
// 없는 게시글(404)·서버 미설정(503)처럼 사용자가 할 수 있는 게 없는 경우엔 카드를 통째로 숨긴다
export default function ReviewAnalysis({ postId }: { postId: number }) {
  const token = useAuthStore((s) => s.accessToken)
  const [fetched, setState] = useState<{ key: string; state: State } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [slow, setSlow] = useState(false)
  // attempt 는 409 재조회 횟수라 '다시 시도' 때 0 으로 돌린다. 이미 0 이면 effect 가 안 돌아서 별도 키로 다시 부른다
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${postId}|${token}|${attempt}|${reloadKey}`

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), SLOW_HINT_DELAY_MS)
    getReviewAnalysis(postId, token)
      .then((data) => {
        if (!cancelled) setState({ key: requestKey, state: data && data.summary ? { kind: 'ready', data } : { kind: 'hidden' } })
      })
      .catch((e) => {
        if (!cancelled) setState({ key: requestKey, state: toErrorState(e, attempt) })
      })
      .finally(() => clearTimeout(slowTimer))
    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [postId, token, attempt, reloadKey, requestKey])

  // 비로그인이면 어차피 401 이라 요청 없이 로그인 안내를 띄운다. 응답 전 상태는 결과의 요청 키로 파생시킨다
  const state: State = !token ? { kind: 'login' } : fetched?.key === requestKey ? fetched.state : { kind: 'loading' }

  // 분석 중이면 일정 간격으로 다시 조회한다. attempt 를 올리면 위 effect 가 다시 돈다
  useEffect(() => {
    if (!token || state.kind !== 'analyzing') return
    const timer = setTimeout(() => setAttempt((n) => n + 1), RETRY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [token, state.kind, attempt])

  const retry = () => {
    setSlow(false)
    setAttempt(0)
    setReloadKey((k) => k + 1)
  }

  if (state.kind === 'hidden') return null

  const pending = state.kind === 'loading' || state.kind === 'analyzing'
  const meta =
    state.kind === 'ready'
      ? [
          // 분석에 쓰인 리뷰 수라 현재 리뷰 수와 다를 수 있다. 그래서 '분석' 을 붙여 구분한다
          state.data.analyzedReviewCount > 0 ? `리뷰 ${state.data.analyzedReviewCount}개 분석` : null,
          formatRelative(state.data.updatedAt),
        ]
          .filter(Boolean)
          .join(' · ')
      : null

  return (
    // 테두리에 그라데이션을 주려면 border 로는 안 돼서, 그라데이션 바탕 + 1px 안쪽 여백으로 감싼다(웹과 같은 방식)
    <LinearGradient
      colors={['rgba(254,106,76,0.7)', 'rgba(254,106,76,0.2)', '#ECECEC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.border}
    >
      <LinearGradient colors={['#FFF6F3', '#FFFFFF', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <SparkleIcon spinning={pending} />
            <Text weight="semibold" color={colors.ink}>
              AI 리뷰 요약
            </Text>
          </View>
          {meta ? (
            <Text size="xs" color={colors.inkMuted}>
              {meta}
            </Text>
          ) : null}
        </View>

        {state.kind === 'ready' ? (
          <>
            <Text weight="medium" color={colors.ink} style={styles.summary}>
              {state.data.summary}
            </Text>
            {state.data.keywords.length > 0 ? (
              <View style={styles.keywords}>
                {state.data.keywords.map((keyword) => (
                  <View key={keyword} style={styles.keyword}>
                    <Text size="xs" weight="medium" color={colors.main}>
                      # {keyword}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text color={colors.inkMuted} style={styles.disclaimer}>
              AI가 리뷰를 바탕으로 작성한 요약이라 실제와 다를 수 있어요.
            </Text>
          </>
        ) : null}

        {pending ? (
          // 로딩 중에도 자리를 잡아둬야 응답이 왔을 때 아래 리뷰 목록이 밀려 내려가지 않는다
          <View style={styles.pending}>
            <Skeleton width="92%" height={14} radius={radius.full} style={styles.pendingBar} />
            <Skeleton width="66%" height={14} radius={radius.full} style={styles.pendingBar} />
            {state.kind === 'analyzing' || slow ? (
              <Text size="xs" color={colors.inkSub}>
                AI가 리뷰를 읽고 있어요. 처음 분석할 땐 30초 정도 걸릴 수 있어요.
              </Text>
            ) : null}
          </View>
        ) : null}

        {state.kind === 'notEnough' ? (
          <Text size="sm" color={colors.inkSub}>
            리뷰가 3개 이상 쌓이면 AI가 리뷰를 요약해드려요.
          </Text>
        ) : null}

        {state.kind === 'failed' ? (
          <View style={styles.actionRow}>
            <Text size="sm" color={colors.inkSub} style={styles.flex}>
              리뷰 분석에 실패했어요. 잠시 후 다시 시도해주세요.
            </Text>
            <Pressable onPress={retry} style={styles.retry}>
              <Text size="xs" weight="medium" color={colors.main}>
                다시 시도
              </Text>
            </Pressable>
          </View>
        ) : null}

        {state.kind === 'login' ? (
          <View style={styles.actionRow}>
            <Text size="sm" color={colors.inkSub} style={styles.flex}>
              로그인하면 AI가 정리한 리뷰 요약을 볼 수 있어요.
            </Text>
            <Pressable onPress={() => router.push(SIGNIN_PATH)} style={styles.login}>
              <Text size="xs" weight="medium" color={colors.white}>
                로그인
              </Text>
            </Pressable>
          </View>
        ) : null}
      </LinearGradient>
    </LinearGradient>
  )
}

function toErrorState(e: unknown, attempt: number): State {
  if (!(e instanceof ApiError)) return { kind: 'failed' }
  // 토큰이 만료된 경우. 다시 로그인하면 볼 수 있다
  if (e.status === 401) return { kind: 'login' }
  switch (e.code) {
    case 'REVIEW_ANALYSIS_IN_PROGRESS':
      return attempt < MAX_RETRIES ? { kind: 'analyzing' } : { kind: 'failed' }
    case 'NOT_ENOUGH_REVIEWS_TO_ANALYZE':
      return { kind: 'notEnough' }
    case 'REVIEW_ANALYSIS_FAILED':
      return { kind: 'failed' }
    default:
      // 글이 없거나 서버 설정이 빠진 경우엔 다시 요청해도 달라지지 않는다
      return { kind: 'hidden' }
  }
}

function SparkleIcon({ spinning }: { spinning: boolean }) {
  const [rotation] = useState(() => new Animated.Value(0))
  const loopRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (!spinning) {
      loopRef.current?.stop()
      rotation.setValue(0)
      return
    }
    loopRef.current = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }))
    loopRef.current.start()
    return () => loopRef.current?.stop()
  }, [spinning, rotation])

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Defs>
          <SvgGradient id="sparkle" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FF9A7F" />
            <Stop offset="100%" stopColor={colors.main} />
          </SvgGradient>
        </Defs>
        <Path d="M12 2c.4 4.6 2.9 7.6 8 10-5.1 2.4-7.6 5.4-8 10-.4-4.6-2.9-7.6-8-10 5.1-2.4 7.6-5.4 8-10Z" fill="url(#sparkle)" />
      </Svg>
    </Animated.View>
  )
}

// 요약이 언제 갱신됐는지 알아야 오래된 분석인지 판단할 수 있어 상대 시간으로 보여준다
function formatRelative(iso: string | null) {
  const time = parseDate(iso)
  if (Number.isNaN(time)) return null
  const minutes = Math.floor((Date.now() - time) / 60000)
  if (minutes < 1) return '방금 업데이트'
  if (minutes < 60) return `${minutes}분 전 업데이트`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전 업데이트`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전 업데이트`
  return `${formatLocaleDate(iso)} 업데이트`
}

const styles = StyleSheet.create({
  border: {
    borderRadius: radius.xl,
    padding: 1,
  },
  card: {
    borderRadius: 11,
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summary: {
    fontSize: 15,
    lineHeight: 24,
  },
  keywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keyword: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.mainSoft,
  },
  disclaimer: {
    fontSize: 11,
    lineHeight: 14,
  },
  pending: {
    gap: 10,
  },
  pendingBar: {
    backgroundColor: colors.mainSoft,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  retry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.main,
  },
  login: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.main,
  },
})
