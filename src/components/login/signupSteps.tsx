import { useState, type Dispatch, type SetStateAction } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import InputField from '@/components/login/InputField'
import SubmitButton from '@/components/login/SubmitButton'
import { toast } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { checkEmail, checkPhone, checkUsername } from '@/lib/member'
import { checkPhoneVerifyCode, checkVerifyCode, sendPhoneVerifyCode, sendVerifyCode } from '@/lib/auth'

export interface SignUpFormData {
  name: string
  username: string
  email: string
  emailVerification: string
  password: string
  passwordConfirm: string
  phone: string
  phoneVerification: string
}

interface StepProps {
  formData: SignUpFormData
  setFormData: Dispatch<SetStateAction<SignUpFormData>>
  onNext: () => void
}

// 회원가입·비밀번호 재설정·비밀번호 변경이 같은 규칙이어야 로그인 폼과 어긋나지 않는다
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,32}$/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function LinkButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={disabled && styles.dim}>
      <Text size="xs" color={colors.zinc500} style={styles.underline}>
        {label}
      </Text>
    </Pressable>
  )
}

// ── 1단계: 약관 동의 ─────────────────────────────

function CheckRow({
  checked,
  onToggle,
  essential,
  label,
  link,
}: {
  checked: boolean
  onToggle: () => void
  essential: boolean
  label: string
  link: string
}) {
  return (
    <View style={styles.checkRow}>
      <Pressable onPress={onToggle} style={styles.checkLabel} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={18} color={checked ? colors.main : colors.zinc400} />
        <Text size="xs" color={essential ? colors.main : colors.zinc400}>
          {essential ? '(필수)' : '(선택)'}
        </Text>
        <Text size="xs" color="#1E293B" style={styles.flex}>
          {label}
        </Text>
      </Pressable>
      <Pressable onPress={() => router.push(link as never)} hitSlop={8} accessibilityLabel={`${label} 보기`}>
        <Ionicons name="chevron-forward" size={18} color={colors.zinc400} />
      </Pressable>
    </View>
  )
}

export function TermsAgreement({ onNext }: { onNext: () => void }) {
  const [terms, setTerms] = useState({ service: false, privacy: false, thirdParty: false, location: false })
  const allChecked = Object.values(terms).every(Boolean)
  const isEssentialAgreed = terms.service && terms.privacy && terms.thirdParty

  const toggle = (key: keyof typeof terms) => setTerms((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <View style={styles.terms}>
      <Pressable
        onPress={() => setTerms({ service: !allChecked, privacy: !allChecked, thirdParty: !allChecked, location: !allChecked })}
        style={styles.checkLabel}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allChecked }}
      >
        <Ionicons name={allChecked ? 'checkbox' : 'square-outline'} size={18} color={allChecked ? colors.main : colors.zinc400} />
        <Text size="xs" weight="bold" color="#1E293B">
          전체 동의하기
        </Text>
      </Pressable>
      <View style={styles.rule} />
      {/* 약관 문서가 있는 항목은 앱의 약관 화면으로, 아직 없는 항목은 웹처럼 준비 중 안내로 보낸다 */}
      <CheckRow checked={terms.service} onToggle={() => toggle('service')} essential label="'잇다' 서비스 이용약관" link="/eula" />
      <CheckRow checked={terms.privacy} onToggle={() => toggle('privacy')} essential label="개인정보 수집 및 이용 동의" link="/privateinfo" />
      <CheckRow
        checked={terms.thirdParty}
        onToggle={() => toggle('thirdParty')}
        essential
        label="제 3자 개인정보 수집 이용 동의"
        link="/notice?title=제 3자 개인정보 수집 이용 동의"
      />
      <View style={styles.rule} />
      <CheckRow
        checked={terms.location}
        onToggle={() => toggle('location')}
        essential={false}
        label="위치기반 서비스 이용약관"
        link="/notice?title=위치기반 서비스 이용약관"
      />
      <View style={styles.stepButton}>
        <SubmitButton label="다음" enabled={isEssentialAgreed} onPress={onNext} />
      </View>
    </View>
  )
}

// ── 2단계: 정보 입력 ─────────────────────────────

export function InputData({ formData, setFormData, onNext }: StepProps) {
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const change = (key: keyof SignUpFormData, value: string) => {
    if (key === 'username') setUsernameError(null)
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const isInvalidPassword = formData.password.length > 0 && !PASSWORD_REGEX.test(formData.password)
  const isPasswordMismatch = formData.passwordConfirm.length > 0 && formData.password !== formData.passwordConfirm
  const isIdValid = /^[A-Za-z0-9]+$/.test(formData.username)
  const isAllValid =
    formData.name.trim() !== '' &&
    formData.username.trim() !== '' &&
    isIdValid &&
    PASSWORD_REGEX.test(formData.password) &&
    formData.password === formData.passwordConfirm

  async function handleNext() {
    if (!isAllValid || checking) return
    setChecking(true)
    try {
      await checkUsername(formData.username)
      onNext()
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : '아이디 확인에 실패했습니다.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <View style={styles.step}>
      <InputField placeholder="본명을 입력해주세요" value={formData.name} onChangeText={(v) => change('name', v)} />
      <InputField
        placeholder="아이디를 입력해주세요"
        value={formData.username}
        onChangeText={(v) => change('username', v)}
        autoCapitalize="none"
        autoCorrect={false}
        isError={!!usernameError || (!isIdValid && formData.username.length > 0)}
        label={usernameError ? `아이디 입력 · ${usernameError}` : '아이디 입력 · 영문 또는 숫자만 가능합니다'}
      />
      <InputField
        placeholder="비밀번호를 입력해주세요"
        value={formData.password}
        onChangeText={(v) => change('password', v)}
        secureTextEntry
        showIcon
        autoCapitalize="none"
        isError={isInvalidPassword}
        label="비밀번호 입력 · 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다"
      />
      <InputField
        placeholder="비밀번호를 다시 입력해주세요"
        value={formData.passwordConfirm}
        onChangeText={(v) => change('passwordConfirm', v)}
        secureTextEntry
        showIcon
        autoCapitalize="none"
        isError={isPasswordMismatch}
        label="비밀번호 확인 · 비밀번호가 일치하지 않습니다"
      />
      <View style={styles.stepButton}>
        <SubmitButton label={checking ? '확인 중...' : '다음'} enabled={isAllValid && !checking} onPress={() => void handleNext()} />
      </View>
    </View>
  )
}

// ── 3단계: 이메일 인증 ─────────────────────────────

export function InputEmail({ formData, setFormData, onNext }: StepProps) {
  const [showVerification, setShowVerification] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const isValid = formData.email.trim() !== '' && EMAIL_REGEX.test(formData.email)

  async function handleSendCode() {
    setIsWaiting(true)
    try {
      await checkEmail(formData.email)
      await sendVerifyCode(formData.email)
      setShowVerification(true)
      toast.success('인증번호가 발송되었습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '인증번호 발송에 실패했습니다.')
    } finally {
      setIsWaiting(false)
    }
  }

  async function handleVerify() {
    setIsWaiting(true)
    try {
      await checkVerifyCode(formData.email, formData.emailVerification)
      onNext()
    } catch {
      toast.error('인증번호가 일치하지 않습니다.')
    } finally {
      setIsWaiting(false)
    }
  }

  return (
    <View style={styles.step}>
      <InputField
        placeholder="이메일을 입력해주세요"
        value={formData.email}
        onChangeText={(v) => setFormData((prev) => ({ ...prev, email: v }))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {showVerification ? (
        <InputField
          placeholder="인증번호를 입력해주세요"
          value={formData.emailVerification}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, emailVerification: v }))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
        />
      ) : null}
      <View style={styles.stepButton}>
        <SubmitButton
          label={isWaiting ? '처리 중...' : showVerification ? '다음' : '인증번호 발송'}
          enabled={isValid && !isWaiting}
          onPress={() => void (showVerification ? handleVerify() : handleSendCode())}
        />
      </View>
      {showVerification ? <LinkButton label="인증번호 재발송" onPress={() => void handleSendCode()} disabled={isWaiting} /> : null}
    </View>
  )
}

// ── 4단계: 전화번호 인증 ─────────────────────────────

export function InputPhone({ formData, setFormData, onNext }: StepProps) {
  const [showVerification, setShowVerification] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [resending, setResending] = useState(false)

  const isPhoneValid = /^010-\d{4}-\d{4}$/.test(formData.phone)
  const isAllValid = isPhoneValid && (!showVerification || formData.phoneVerification.trim() !== '')
  // 서버는 하이픈 유무를 가리지 않지만, 저장 형식을 하나로 맞춘다
  const plainPhone = formData.phone.replace(/-/g, '')

  async function handleSubmit() {
    if (!isAllValid || isWaiting) return
    setIsWaiting(true)
    try {
      if (!showVerification) {
        // 이미 가입된 번호인지 먼저 확인한 뒤 인증번호를 보낸다
        await checkPhone(formData.phone)
        await sendPhoneVerifyCode(plainPhone)
        setShowVerification(true)
        toast.success('인증번호를 발송했습니다.')
      } else {
        await checkPhoneVerifyCode(plainPhone, formData.phoneVerification.trim())
        toast.success('전화번호 인증이 완료되었습니다.')
        onNext()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '처리에 실패했습니다.')
    } finally {
      setIsWaiting(false)
    }
  }

  async function handleResend() {
    if (resending) return
    setResending(true)
    try {
      await sendPhoneVerifyCode(plainPhone)
      setFormData((prev) => ({ ...prev, phoneVerification: '' }))
      toast.success('인증번호를 재발송했습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '재발송에 실패했습니다.')
    } finally {
      setResending(false)
    }
  }

  return (
    <View style={styles.step}>
      <InputField
        placeholder="전화번호를 입력해주세요"
        value={formData.phone}
        onChangeText={(v) => setFormData((prev) => ({ ...prev, phone: formatPhone(v) }))}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      {showVerification ? (
        <InputField
          placeholder="인증번호를 입력해주세요"
          value={formData.phoneVerification}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, phoneVerification: v }))}
          keyboardType="number-pad"
          autoComplete="sms-otp"
        />
      ) : null}
      <View style={styles.stepButton}>
        <SubmitButton
          label={isWaiting ? '처리 중...' : showVerification ? '인증 확인' : '인증번호 발송'}
          enabled={isAllValid && !isWaiting}
          onPress={() => void handleSubmit()}
        />
      </View>
      {showVerification ? <LinkButton label={resending ? '재발송 중...' : '인증번호 재발송'} onPress={() => void handleResend()} disabled={resending} /> : null}
      <LinkButton label="나중에 하기" onPress={onNext} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  underline: { textDecorationLine: 'underline' },
  terms: {
    width: '100%',
    maxWidth: 300,
    gap: 4,
    paddingTop: 20,
  },
  rule: {
    height: 1,
    backgroundColor: colors.zinc300,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  checkLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  step: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    paddingTop: 20,
  },
  stepButton: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 24,
  },
})
