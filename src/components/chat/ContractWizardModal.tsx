import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import TextField, { Field } from '@/components/ui/TextField'
import DateField from '@/components/ui/DateField'
import { toast } from '@/components/ui/Toast'
import BackHeader from '@/components/BackHeader'
import SignaturePad from '@/components/chat/SignaturePad'
import { colors, PAGE_X, radius } from '@/constants/theme'
import type { ContractData } from '@/lib/chatMessages'
import { contractArticles, formatContractDate, josa } from '@/lib/contractDocument'
import { buildContractPdf } from '@/lib/contractPdf'
import { MIN_AMOUNT_MESSAGE, isBelowMinAmount } from '@/lib/amount'
import { confirm } from '@/lib/dialog'
import { toAbsoluteUrl, type LocalFile } from '@/lib/file'
import { formatNumber } from '@/lib/http'

// 웹과 같은 계약 금액 상한
const MAX_PRICE = 1_000_000_000

function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
}

interface ContractWizardModalProps {
  myRole: 'client' | 'professional'
  /**
   * propose: 을(파는 사람)이 처음 작성해서 갑에게 보낼 때.
   * review: 갑(사는 사람)이 받은 제안을 검토하고 서명할 때 — 이 시점에 양쪽 서명이 다 모이므로 제출과 함께 PDF 를 만들어 등록한다
   */
  mode: 'propose' | 'review'
  initial: Partial<ContractData>
  busy?: boolean
  /** 전화번호 인증 여부. 인증하지 않은 사람은 서명할 수 없다 */
  phoneVerified?: boolean
  onClose: () => void
  /** 휴대폰 인증 안내에서 프로필로 보낼 때 */
  onOpenProfile: () => void
  /** review 모드에서는 만든 PDF 파일도 함께 넘어온다 */
  onSubmit: (data: ContractData, pdf?: LocalFile) => void
}

function SignatureSlot({ label, name, signature }: { label: string; name: string; signature: string }) {
  return (
    <View style={styles.party}>
      <Text size="sm" weight="semibold" color={colors.contract}>
        {label}
      </Text>
      <Text size="xs" color={colors.zinc500}>
        성명(기업명) {name}
      </Text>
      {signature ? (
        <Image source={{ uri: toAbsoluteUrl(signature) }} style={styles.signature} contentFit="contain" />
      ) : (
        <View style={styles.signatureEmpty}>
          <Text size="xs" color={colors.zinc400}>
            서명 대기 중
          </Text>
        </View>
      )}
    </View>
  )
}

function StepBadge({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <View style={[styles.stepBadge, active && styles.stepBadgeActive]}>
      {done ? (
        <Ionicons name="checkmark" size={14} color={colors.zinc400} />
      ) : (
        <Text size="xs" weight="bold" color={active ? colors.white : colors.zinc400}>
          {index}
        </Text>
      )}
    </View>
  )
}

// 웹 chat/ContractWizardModal. 웹은 넓은 화면에서 계약서 미리보기와 입력칸을 나란히 두지만,
// 휴대폰은 입력칸을 위에, 계약서 전문 미리보기를 아래에 둔다(웹 모바일과 같은 순서)
export default function ContractWizardModal({
  myRole,
  mode,
  initial,
  busy,
  phoneVerified,
  onClose,
  onOpenProfile,
  onSubmit,
}: ContractWizardModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [clientName, setClientName] = useState(initial.clientName ?? '')
  const [professionalName, setProfessionalName] = useState(initial.professionalName ?? '')
  const [startDate, setStartDate] = useState(initial.startDate ?? '')
  const [endDate, setEndDate] = useState(initial.endDate ?? '')
  const [inspectionDays, setInspectionDays] = useState(initial.inspectionDays != null ? String(initial.inspectionDays) : '')
  const [serviceContent, setServiceContent] = useState(initial.serviceContent ?? '')
  const [price, setPrice] = useState(initial.price ? String(initial.price) : '')
  const [clientSig, setClientSig] = useState(initial.clientSig ?? '')
  const [professionalSig, setProfessionalSig] = useState(initial.professionalSig ?? '')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  // 서명을 그리는 동안은 바깥 스크롤을 멈춘다
  const [drawing, setDrawing] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const termsEditable = mode === 'propose'
  const isReview = mode === 'review'
  const verified = phoneVerified !== false
  const numericPrice = Number(price || 0)
  const priceTooLow = isBelowMinAmount(numericPrice)

  const step1Valid =
    !priceTooLow &&
    clientName.trim() !== '' &&
    professionalName.trim() !== '' &&
    (!termsEditable || (startDate !== '' && endDate !== '' && inspectionDays.trim() !== '' && serviceContent.trim() !== ''))

  const mySig = myRole === 'client' ? clientSig : professionalSig
  // review 는 갑이 마지막으로 서명하는 단계라, 제출하려면 양쪽 서명이 다 있어야 한다(바로 서버에 등록되므로)
  const canSubmit = (isReview ? clientSig !== '' && professionalSig !== '' : mySig !== '') && verified

  function goToSignature() {
    if (numericPrice > MAX_PRICE) {
      toast.error('최대 결제금액은 10억원이에요.')
      return
    }
    if (startDate > endDate) {
      toast.error('계약 시작일은 종료일보다 앞서야 해요.')
      return
    }
    changeStep(2)
  }

  // 1단계를 내려 쓴 자리 그대로 2단계로 넘어가면 서명칸이 화면 위로 지나가 있어서, 단계를 바꿀 때마다 맨 위로 올린다
  function changeStep(next: 1 | 2) {
    setStep(next)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  function collectData(): ContractData {
    return {
      clientName,
      professionalName,
      startDate,
      endDate,
      inspectionDays: Number(inspectionDays),
      serviceContent,
      price: numericPrice,
      clientSig,
      professionalSig,
    }
  }

  async function handleSubmit() {
    const data = collectData()
    if (!isReview) {
      onSubmit(data)
      return
    }
    if (generatingPdf) return
    setGeneratingPdf(true)
    try {
      onSubmit(data, await buildContractPdf(data))
    } catch {
      toast.error('계약서 PDF 를 만들지 못했어요. 다시 시도해주세요.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  // 웹은 바깥을 눌러도 닫히지 않게만 막았다. 앱은 뒤로가기 한 번에 쓰던 내용·서명이 사라지므로 한 번 묻는다
  async function requestClose() {
    if (busy || generatingPdf) return
    if (await confirm('작성 중인 계약서를 닫을까요?', { confirmText: '닫기' })) onClose()
  }

  const articles = contractArticles({ serviceContent, startDate, endDate, inspectionDays, price: numericPrice })

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => void requestClose()}>
      <View style={styles.container}>
        <BackHeader title={`계약서 ${mode === 'propose' ? '작성' : '검토 및 서명'}`} onBack={() => void requestClose()} />
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView ref={scrollRef} scrollEnabled={!drawing} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.panel}>
              <View style={styles.steps}>
                <StepBadge index={1} active={step === 1} done={step === 2} />
                <Text size="sm" weight={step === 1 ? 'semibold' : 'regular'} color={step === 1 ? colors.main : colors.zinc400}>
                  기본 정보 입력
                </Text>
                <View style={[styles.stepLine, step === 2 && styles.stepLineDone]} />
                <StepBadge index={2} active={step === 2} done={false} />
                <Text size="sm" weight={step === 2 ? 'semibold' : 'regular'} color={step === 2 ? colors.main : colors.zinc400}>
                  서명
                </Text>
              </View>

              {step === 1 ? (
                <View style={styles.form}>
                  <Field label="갑 성명">
                    <TextField value={clientName} onChangeText={setClientName} editable={myRole === 'client'} placeholder="갑 성명" />
                  </Field>
                  <Field label="을 성명">
                    <TextField value={professionalName} onChangeText={setProfessionalName} editable={myRole === 'professional'} placeholder="을 성명" />
                  </Field>
                  <Field label="계약 시작일">
                    <DateField value={startDate} onChange={setStartDate} disabled={!termsEditable} placeholder="계약 시작일" />
                  </Field>
                  <Field label="계약 종료일">
                    <DateField value={endDate} onChange={setEndDate} disabled={!termsEditable} placeholder="계약 종료일" />
                  </Field>
                  <Field label="검수 일수">
                    <TextField
                      value={inspectionDays}
                      onChangeText={(v) => setInspectionDays(digitsOnly(v).slice(0, 4))}
                      editable={termsEditable}
                      keyboardType="number-pad"
                      placeholder="검수 일수"
                      right={
                        <Text size="sm" color={colors.zinc400}>
                          일
                        </Text>
                      }
                    />
                  </Field>
                  {/* 빈 칸일 때는 아직 입력 전이라 띄우지 않는다. 받은 계약서(수정 불가)에 하한 미만 금액이 있으면 서명 전에 이유를 보여준다 */}
                  <Field label="계약 금액" error={price !== '' && priceTooLow ? MIN_AMOUNT_MESSAGE : null}>
                    <TextField
                      value={price ? formatNumber(Number(price)) : ''}
                      onChangeText={(v) => setPrice(digitsOnly(v).slice(0, 13))}
                      editable={termsEditable}
                      keyboardType="number-pad"
                      placeholder="계약 금액"
                      invalid={price !== '' && priceTooLow}
                      right={
                        <Text size="sm" color={colors.zinc400}>
                          원
                        </Text>
                      }
                    />
                  </Field>
                  <Field label="1조 내용 (용역 내용)">
                    <TextField
                      value={serviceContent}
                      onChangeText={setServiceContent}
                      editable={termsEditable}
                      multiline
                      placeholder="어떤 용역을 수행하는지 적어주세요"
                    />
                  </Field>
                  <Button size="lg" disabled={!step1Valid} onPress={goToSignature}>
                    다음
                  </Button>
                </View>
              ) : (
                <View style={styles.form}>
                  {!verified ? (
                    <View style={styles.verifyBox}>
                      <Text size="sm" color={colors.zinc600} align="center">
                        전화번호 인증을 완료해야 서명할 수 있어요.
                      </Text>
                      <Pressable onPress={onOpenProfile} hitSlop={6}>
                        <Text size="xs" color={colors.main} style={styles.underline}>
                          프로필에서 인증하기
                        </Text>
                      </Pressable>
                    </View>
                  ) : myRole === 'client' ? (
                    <SignaturePad label="갑" savedUrl={clientSig} onSave={setClientSig} onDrawingChange={setDrawing} />
                  ) : (
                    <SignaturePad label="을" savedUrl={professionalSig} onSave={setProfessionalSig} onDrawingChange={setDrawing} />
                  )}
                  <View style={styles.buttons}>
                    <Button variant="secondary" size="lg" style={styles.flex} onPress={() => changeStep(1)}>
                      이전으로
                    </Button>
                    <Button
                      size="lg"
                      style={styles.flex}
                      loading={busy || generatingPdf}
                      disabled={!canSubmit}
                      onPress={() => void handleSubmit()}
                    >
                      {generatingPdf
                        ? 'PDF 생성 중...'
                        : busy
                          ? isReview
                            ? '등록 중...'
                            : '전송 중...'
                          : mode === 'propose'
                            ? '제안하기'
                            : '서명하고 계약서 등록'}
                    </Button>
                  </View>
                </View>
              )}
            </View>

            {/* 계약서 미리보기 */}
            <View style={styles.previewArea}>
              <View style={styles.paper}>
                <View style={styles.watermarkLayer} pointerEvents="none">
                  <Image source={require('@/assets/images/contract-watermark.png')} style={styles.watermark} contentFit="contain" />
                </View>
                <Text size="2xl" weight="bold" color={colors.contract} align="center" style={styles.title}>
                  용 역 계 약 서
                </Text>
                <Text size="sm" color={colors.zinc700} style={styles.relaxed}>
                  <Text size="sm" weight="bold" color={colors.contract}>
                    {clientName || ' '}
                  </Text>
                  {josa(clientName, '과', '와')}(이하 &apos;갑&apos;이라 한다){' '}
                  <Text size="sm" weight="bold" color={colors.contract}>
                    {professionalName || ' '}
                  </Text>
                  {josa(professionalName, '은', '는')}(이하 &apos;을&apos;이라 한다) 아래 용역에 관하여 다음과 같이 계약을 체결한다.
                </Text>
                <View style={styles.articles}>
                  {articles.map((article) => (
                    <View key={article.title} style={styles.article}>
                      <Text size="xs" weight="bold" color={colors.contract}>
                        {article.title}
                      </Text>
                      <Text size="xs" color={colors.zinc800} style={styles.articleBody}>
                        {article.body}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text weight="bold" color={colors.contract} align="center" style={styles.date}>
                  {startDate ? formatContractDate(startDate) : ' '}
                </Text>
                <View style={styles.parties}>
                  <SignatureSlot label="갑 (의뢰인)" name={clientName} signature={clientSig} />
                  <SignatureSlot label="을 (수행자)" name={professionalName} signature={professionalSig} />
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  content: { paddingBottom: 48 },
  panel: { gap: 20, paddingHorizontal: PAGE_X, paddingVertical: 24 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.zinc100,
  },
  stepBadgeActive: { backgroundColor: colors.main },
  stepLine: { flex: 1, height: 1, backgroundColor: colors.zinc200 },
  stepLineDone: { backgroundColor: colors.main },
  form: { gap: 16 },
  verifyBox: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  underline: { textDecorationLine: 'underline' },
  buttons: { flexDirection: 'row', gap: 8 },
  previewArea: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.zinc50,
  },
  paper: {
    gap: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  // 웹처럼 로고를 45도 돌려 옅게 깐다
  watermarkLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermark: { width: '45%', aspectRatio: 1, opacity: 0.1, transform: [{ rotate: '-45deg' }] },
  title: { letterSpacing: 4 },
  relaxed: { lineHeight: 23 },
  articles: { gap: 12 },
  article: { gap: 4 },
  articleBody: { lineHeight: 19 },
  date: { letterSpacing: 2 },
  parties: { flexDirection: 'row', gap: 16 },
  party: { flex: 1, gap: 8, paddingTop: 16, borderTopWidth: 2, borderTopColor: colors.contract },
  signature: {
    height: 96,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  signatureEmpty: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.zinc50,
  },
})
