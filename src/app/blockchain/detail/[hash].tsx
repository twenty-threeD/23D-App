import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import { toast } from '@/components/ui/Toast'
import BackHeader from '@/components/BackHeader'
import ChainSearchInput from '@/components/blockchain/ChainSearchInput'
import { colors, PAGE_X, radius } from '@/constants/theme'
import { formatAmount, getTxVerification, type TxVerification } from '@/lib/chain'
import { display } from '@/lib/display'
import { toAbsoluteUrl } from '@/lib/file'
import { useAuthStore } from '@/store/authStore'

/** 값 옆의 복사 버튼 */
function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Pressable
      onPress={() => void Clipboard.setStringAsync(value).then(() => toast.success('복사되었습니다.'))}
      hitSlop={8}
      accessibilityLabel={`${label} 복사`}
    >
      <Ionicons name="copy-outline" size={14} color={colors.placeholder} />
    </Pressable>
  )
}

/** 트랜잭션 정보 카드의 한 줄. 값이 없으면 '-' 를 보여주고 복사 버튼은 감춘다 */
function Field({ label, value, copyable = false }: { label: string; value: string | null; copyable?: boolean }) {
  return (
    <View style={styles.field}>
      <Text size="xs" weight="medium" color={colors.placeholder}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        {/* 해시처럼 긴 값은 줄바꿈 대신 말줄임으로 한 줄을 지킨다. 전체 값은 복사 버튼으로 가져간다 */}
        <Text weight="medium" numberOfLines={1} ellipsizeMode="middle" style={styles.shrink}>
          {display(value)}
        </Text>
        {copyable && value ? <CopyButton value={value} label={label} /> : null}
      </View>
    </View>
  )
}

/** 확인 여부만 알려주는 줄. 서버가 판단하지 못한 null 은 확인 실패와 뜻이 달라 문구만 따로 둔다 */
function CheckField({ label, checked }: { label: string; checked: boolean | null }) {
  const text = checked === null ? '확인불가' : checked ? '확인됨' : '확인되지 않음'
  return (
    <View style={styles.field}>
      <Text size="xs" weight="medium" color={colors.placeholder}>
        {label}
      </Text>
      <Text weight="semibold" color={checked ? colors.main : colors.danger}>
        {text}
      </Text>
    </View>
  )
}

/** 체인에 기록이 남아 있는지 보여주는 배지 */
function LedgerBadge({ matched }: { matched: boolean }) {
  const color = matched ? colors.main : colors.placeholder
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text size="xs" weight="semibold" color={color}>
        {matched ? '기록됨' : '기록없음'}
      </Text>
    </View>
  )
}

export default function Page() {
  const { hash } = useLocalSearchParams<{ hash: string }>()
  const txHash = decodeURIComponent(hash ?? '')
  // 토큰을 함께 보내야 서버가 당사자로 보고 계약 상세를 내려준다
  const token = useAuthStore((s) => s.accessToken)
  const [result, setResult] = useState<{ key: string; verification: TxVerification | null; error: string | null } | null>(null)
  const requestKey = `${txHash}|${token}`
  const current = result?.key === requestKey ? result : null
  const verification = current?.verification ?? null
  const error = current?.error ?? null

  useEffect(() => {
    let cancelled = false
    getTxVerification(txHash, token)
      .then((v) => {
        if (!cancelled) setResult({ key: requestKey, verification: v, error: null })
      })
      .catch((cause: Error) => {
        if (!cancelled) setResult({ key: requestKey, verification: null, error: cause.message })
      })
    return () => {
      cancelled = true
    }
  }, [txHash, token, requestKey])

  const detail = verification?.detail ?? null

  return (
    <View style={styles.container}>
      <BackHeader fallbackHref="/blockchain" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ChainSearchInput onSearch={(input) => router.replace({ pathname: '/blockchain/detail/[hash]', params: { hash: input } })} />

        <View style={styles.card}>
          <View style={styles.cardTitle}>
            <Text size="2xl" weight="medium">
              트랜잭션 정보
            </Text>
            {verification ? <LedgerBadge matched={verification.ledgerMatched} /> : null}
          </View>
          {error ? (
            <Text weight="medium" color={colors.placeholder}>
              {error}
            </Text>
          ) : (
            <View style={styles.fields}>
              <Field label="해시(hash)" value={verification?.txHash ?? txHash} copyable />
              <Field label="높이(height)" value={verification?.height != null ? String(verification.height) : null} copyable />
              <Field label="주문번호(orderId)" value={verification?.orderId ?? null} copyable />
              <Field label="결제액" value={formatAmount(verification?.amount ?? null)} />
              <Field label="결제 일시" value={verification?.paidAt ?? null} />
              {/* 결제 당사자에게만 계약 상세가 내려온다 */}
              {detail && verification ? (
                <>
                  <CheckField label="블록체인 결제 내역" checked={verification.ledgerMatched} />
                  <CheckField label="트랜잭션 서명" checked={verification.signatureValid} />
                  <View style={styles.field}>
                    <Text size="xs" weight="medium" color={colors.placeholder}>
                      계약서 주소
                    </Text>
                    <Pressable onPress={() => void Linking.openURL(toAbsoluteUrl(detail.contractUrl)).catch(() => {})}>
                      <Text weight="medium" numberOfLines={1} ellipsizeMode="middle" color={colors.link}>
                        {detail.contractUrl}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text size="2xl" weight="medium">
            트랜잭션 검증여부
          </Text>
          {verification === null ? (
            <Text size="xl" weight="medium" color={colors.placeholder}>
              {error ?? '조회 중'}
            </Text>
          ) : verification.verified ? (
            <View style={styles.verifyRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.main} />
              <Text size="xl" weight="medium" color={colors.main}>
                검증됨
              </Text>
            </View>
          ) : (
            <View style={styles.failed}>
              <Text size="xs" weight="medium" color={colors.placeholder}>
                {display(verification.reason)}
              </Text>
              <View style={styles.verifyRow}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
                <Text size="xl" weight="medium" color={colors.danger}>
                  {display(verification.reasonMessage ?? '검증되지 않음')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { padding: PAGE_X, gap: 16, paddingBottom: 40 },
  card: { gap: 28, padding: 24, borderRadius: radius.xl, backgroundColor: colors.surfaceAlt },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fields: { gap: 16 },
  field: { gap: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2 },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  failed: { gap: 6 },
})
