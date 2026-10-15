import type { CallPhase } from '@/store/callStore'
import type { CallType } from '@/lib/call'
import { formatCallDuration } from '@/hooks/useCallClock'

// 도크·전체화면·채팅방 카드가 같은 문구를 쓴다
export function callStatusText(phase: CallPhase, callType: CallType | undefined, peerReconnecting: boolean, elapsed: number) {
  if (phase === 'incoming') return callType === 'VIDEO' ? '영상 통화 요청' : '음성 통화 요청'
  if (phase === 'connecting') return '연결하는 중'
  if (phase === 'outgoing') return '상대방을 기다리는 중'
  if (peerReconnecting) return '상대방 연결을 기다리는 중'
  return formatCallDuration(elapsed)
}
