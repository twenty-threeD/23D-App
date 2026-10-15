import type { ChatPayment } from '@/components/chat/PaymentCard'
import type { ChatCall } from './callLog'

export interface Message {
  messageId: number
  roomId: number
  senderUsername: string
  senderName: string
  message: string
  createdAt: string
  attachedFileUrls: string[]
  // 백엔드가 결제 승인 시 PAYMENT, 통화 종료 시 CALL 타입 메시지를 직접 만들어 넣어준다
  type?: 'TEXT' | 'PAYMENT' | 'CALL'
  payment?: ChatPayment | null
  call?: ChatCall | null
}

// 계약서 제안 메시지에 실려 오가는 계약 내용. 웹 ContractWizardModal 의 ContractData 와 같은 모양이어야
// 웹·앱 사용자가 같은 방에서 계약서를 주고받을 수 있다
export interface ContractData {
  clientName: string
  professionalName: string
  startDate: string
  endDate: string
  inspectionDays: number
  serviceContent: string
  price: number
  clientSig: string
  professionalSig: string
}

export interface CompletedContract {
  contractId: number
  price: number
  contractUrl: string
}

export type ContractMessage = { kind: 'propose'; data: ContractData } | { kind: 'completed'; data: CompletedContract }

export const CONTRACT_PROPOSE_PREFIX = '[계약서 제안]\n'
export const CONTRACT_COMPLETED_PREFIX = '[계약서 체결 완료]\n'
export const PAYMENT_PREFIX = '[결제 완료]\n'

// 결제 완료 알림. 백엔드가 채팅 메시지를 만들어주지 않던 시절부터 프론트가 접두사 규약으로 보낸다
export function parsePaymentMessage(text: string): ChatPayment | null {
  if (!text?.startsWith(PAYMENT_PREFIX)) return null
  try {
    return JSON.parse(text.slice(PAYMENT_PREFIX.length)) as ChatPayment
  } catch {
    return null
  }
}

export function parseContractMessage(text: string): ContractMessage | null {
  if (text?.startsWith(CONTRACT_PROPOSE_PREFIX)) {
    try {
      const parsed = JSON.parse(text.slice(CONTRACT_PROPOSE_PREFIX.length)) as Record<string, unknown>
      // 예전 채팅에는 문자열 금액과 검수일수가 저장되어 있어 읽을 때 숫자로 맞춘다.
      const toNumber = (value: unknown) => {
        let number = Number.NaN
        if (typeof value === 'number') number = value
        else if (typeof value === 'string') number = Number(value.replace(/,/g, '').trim())
        return Number.isFinite(number) ? number : 0
      }
      const str = (value: unknown) => (typeof value === 'string' ? value : '')
      return {
        kind: 'propose',
        data: {
          clientName: str(parsed.clientName),
          professionalName: str(parsed.professionalName),
          startDate: str(parsed.startDate),
          endDate: str(parsed.endDate),
          inspectionDays: toNumber(parsed.inspectionDays),
          serviceContent: str(parsed.serviceContent),
          price: toNumber(parsed.price),
          clientSig: str(parsed.clientSig),
          professionalSig: str(parsed.professionalSig),
        },
      }
    } catch {
      return null
    }
  }

  if (text?.startsWith(CONTRACT_COMPLETED_PREFIX)) {
    try {
      return { kind: 'completed', data: JSON.parse(text.slice(CONTRACT_COMPLETED_PREFIX.length)) as CompletedContract }
    } catch {
      return null
    }
  }

  return null
}
