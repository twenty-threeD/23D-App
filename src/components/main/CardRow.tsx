import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactNode } from 'react'
import { AppState, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { PAGE_X } from '@/constants/theme'

// 카드 묶음을 세 벌 이어 그리고 가운데 벌을 보여 준다. 넘기다 앞·뒤 벌로 넘어가면, 멈춘 뒤
// 같은 카드가 있는 가운데 벌 위치로 순간 이동해 끝없이 이어지는 것처럼 보이게 한다(웹과 같은 방식).
// 스크롤이 움직이는 중이나 손가락이 닿아 있는 동안 옮기면 이동이 끊기므로, 멈춘 뒤에만 옮긴다
const LOOP_COPIES = 3
const LOOP_SETTLE_MS = 150

interface CardRowProps {
  children: ReactNode
  /** 카드 한 장의 폭. 스냅·자동 넘김이 다음 카드 시작 위치를 계산하는 데 쓴다 */
  itemWidth: number
  gap: number
  /** 이 간격마다 다음 카드로 넘긴다 (웹은 휴대폰 폭에서만 넘겼다. 앱은 늘 휴대폰이라 그대로 켠다) */
  autoSlideMs?: number
  /** 손을 떼면 가장 가까운 카드 시작 위치에 붙고, 세게 밀어도 한 장씩만 넘어간다 */
  snap?: boolean
  /** 마지막 카드 다음에 첫 카드가 이어지게 순환한다. 실제 카드가 2장 이상일 때만 켠다 */
  loop?: boolean
}

export default function CardRow({ children, itemWidth, gap, autoSlideMs, snap = false, loop = false }: CardRowProps) {
  const scrollRef = useRef<ScrollView>(null)
  const items = Children.toArray(children)
  const looping = loop && items.length > 1
  const interval = itemWidth + gap
  const setWidth = items.length * interval

  // 렌더와 무관한 스크롤 상태라 ref 로만 들고 있는다
  const state = useRef({ x: 0, touching: false, paused: false, contentWidth: 0, viewportWidth: 0 })
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 순환 줄은 처음에 가운데 벌을 보여준다
  useEffect(() => {
    if (!looping) return
    const id = setTimeout(() => scrollRef.current?.scrollTo({ x: setWidth, animated: false }), 0)
    return () => clearTimeout(id)
  }, [looping, setWidth])

  useEffect(() => {
    if (!autoSlideMs) return
    let appActive = AppState.currentState === 'active'
    const sub = AppState.addEventListener('change', (s) => {
      appActive = s === 'active'
    })
    const timer = setInterval(() => {
      const st = state.current
      if (st.paused || st.touching || !appActive) return
      const maxX = Math.max(0, st.contentWidth - st.viewportWidth)
      if (maxX <= 0) return
      // 손으로 넘기다 카드 중간에 멈췄을 수 있어 한 칸 너비를 더하지 않고 다음 카드의 시작 위치로 맞춘다
      const next = (Math.floor((st.x + 4) / interval) + 1) * interval
      const atEnd = st.x >= maxX - 4
      scrollRef.current?.scrollTo({ x: !looping && (atEnd || next > maxX + 4) ? 0 : Math.min(next, maxX), animated: true })
    }, autoSlideMs)
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [autoSlideMs, interval, looping])

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current)
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    [],
  )

  function recenter() {
    const st = state.current
    if (!looping || st.touching || !setWidth) return
    if (st.x < setWidth - 2) scrollRef.current?.scrollTo({ x: st.x + setWidth, animated: false })
    else if (st.x >= setWidth * 2 - 2) scrollRef.current?.scrollTo({ x: st.x - setWidth, animated: false })
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    state.current.x = e.nativeEvent.contentOffset.x
    if (!looping) return
    if (settleTimer.current) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(recenter, LOOP_SETTLE_MS)
  }

  // 손으로 넘기는 동안 움직이면 손가락과 싸우게 되므로, 만지는 동안은 멈추고 손을 뗀 뒤 한 간격을 쉬고 다시 시작한다
  function onTouchStart() {
    state.current.touching = true
    state.current.paused = true
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
  }

  function onTouchEnd() {
    state.current.touching = false
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      state.current.paused = false
    }, autoSlideMs ?? 0)
    if (looping) {
      if (settleTimer.current) clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(recenter, LOOP_SETTLE_MS)
    }
  }

  // 복제 카드도 같은 카드라 key 만 바꿔 그대로 그린다
  const rendered = looping
    ? Array.from({ length: LOOP_COPIES }, (_, copy) =>
        items.map((item) => (isValidElement(item) ? cloneElement(item, { key: `${copy}:${item.key}` }) : item)),
      ).flat()
    : items

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, { gap }]}
      snapToInterval={snap ? interval : undefined}
      snapToAlignment="start"
      decelerationRate={snap ? 'fast' : 'normal'}
      disableIntervalMomentum={snap}
      onScroll={onScroll}
      scrollEventThrottle={32}
      onScrollBeginDrag={onTouchStart}
      onScrollEndDrag={onTouchEnd}
      onLayout={(e) => {
        state.current.viewportWidth = e.nativeEvent.layout.width
      }}
      onContentSizeChange={(w) => {
        state.current.contentWidth = w
      }}
    >
      {rendered.map((child, index) => (
        <View key={isValidElement(child) && child.key != null ? child.key : index}>{child}</View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: PAGE_X,
  },
})
