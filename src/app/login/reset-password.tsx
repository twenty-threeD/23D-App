import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import TextField, { Field, PasswordField } from '@/components/ui/TextField'
import AuthCard from '@/components/login/AuthCard'
import { PASSWORD_REGEX } from '@/components/login/signupSteps'
import { toast } from '@/components/ui/Toast'
import { colors, radius } from '@/constants/theme'
import { sendVerifyCode } from '@/lib/auth'
import { resetPasswordWithoutAuth } from '@/lib/member'
import { SIGNIN_PATH } from '@/lib/navigation'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Page() {
  const [step, setStep] = useState<'identity' | 'reset'>('identity')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const canSendCode = username.trim() !== '' && EMAIL_REGEX.test(email.trim())
  const isInvalidPassword = newPassword.length > 0 && !PASSWORD_REGEX.test(newPassword)
  const isPasswordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canResetPassword = verifyCode.trim() !== '' && PASSWORD_REGEX.test(newPassword) && newPassword === confirmPassword

  async function sendCode(resend: boolean) {
    if (busy || (!resend && !canSendCode)) return
    setBusy(true)
    try {
      await sendVerifyCode(email.trim())
      setVerifyCode('')
      setStep('reset')
      toast.success(resend ? '새 인증번호를 이메일로 보냈습니다.' : '인증번호를 이메일로 보냈습니다.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '인증번호 발송에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    if (!canResetPassword || busy) return
    setBusy(true)
    try {
      await resetPasswordWithoutAuth({ username: username.trim(), email: email.trim(), verifyCode: verifyCode.trim(), newPassword })
      toast.success('비밀번호를 변경했습니다. 다시 로그인해주세요.')
      router.replace(SIGNIN_PATH)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function editIdentity() {
    setStep('identity')
    setVerifyCode('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <AuthCard>
      <View style={styles.titleBlock}>
        <Text size="xl" weight="bold" color={colors.ink}>
          비밀번호 재설정
        </Text>
        <Text size="sm" color={colors.inkSub} align="center">
          {step === 'identity' ? '가입한 아이디와 이메일을 입력해주세요.' : '이메일 인증번호와 새 비밀번호를 입력해주세요.'}
        </Text>
      </View>

      {step === 'identity' ? (
        <View style={styles.form}>
          <Field label="아이디">
            <TextField value={username} onChangeText={setUsername} placeholder="가입한 아이디를 입력해주세요" autoCapitalize="none" autoComplete="username" />
          </Field>
          <Field label="이메일">
            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="가입한 이메일을 입력해주세요"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Field>
          <Button size="lg" loading={busy} disabled={!canSendCode} onPress={() => void sendCode(false)}>
            {busy ? '전송 중...' : '인증번호 발송'}
          </Button>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.identity}>
            <Text size="xs" color={colors.inkSub} style={styles.flex}>
              {username} · {email}
            </Text>
            <Pressable onPress={editIdentity} hitSlop={6}>
              <Text size="xs" color={colors.inkSub} style={styles.underline}>
                수정
              </Text>
            </Pressable>
          </View>
          <Field label="이메일 인증번호">
            <TextField
              value={verifyCode}
              onChangeText={setVerifyCode}
              placeholder="이메일로 받은 인증번호를 입력해주세요"
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
          </Field>
          <Pressable onPress={() => void sendCode(true)} disabled={busy} hitSlop={6} style={styles.resend}>
            <Text size="xs" color={colors.zinc500} style={styles.underline}>
              인증번호 다시 보내기
            </Text>
          </Pressable>
          <Field label="새 비밀번호" error={isInvalidPassword ? '8자 이상, 대소문자, 숫자, 특수문자를 포함해주세요' : null}>
            <PasswordField value={newPassword} onChangeText={setNewPassword} placeholder="새 비밀번호를 입력해주세요" invalid={isInvalidPassword} autoComplete="new-password" />
          </Field>
          <Field label="새 비밀번호 확인" error={isPasswordMismatch ? '비밀번호가 일치하지 않습니다' : null}>
            <PasswordField
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="새 비밀번호를 다시 입력해주세요"
              invalid={isPasswordMismatch}
              autoComplete="new-password"
            />
          </Field>
          <Text size="xs" color={colors.inkHint}>
            인증번호는 비밀번호를 저장할 때 계정 이메일과 함께 확인됩니다.
          </Text>
          <Button size="lg" loading={busy} disabled={!canResetPassword} onPress={() => void handleResetPassword()}>
            {busy ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </View>
      )}

      <Pressable onPress={() => router.replace(SIGNIN_PATH)} hitSlop={6}>
        <Text size="xs" color={colors.zinc500} style={styles.underline}>
          로그인으로 돌아가기
        </Text>
      </Pressable>
    </AuthCard>
  )
}

const styles = StyleSheet.create({
  titleBlock: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  form: {
    width: '100%',
    gap: 16,
    paddingVertical: 12,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.zinc50,
  },
  resend: {
    alignSelf: 'flex-start',
  },
  underline: {
    textDecorationLine: 'underline',
  },
  flex: {
    flex: 1,
  },
})
