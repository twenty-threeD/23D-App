import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Modal, { ModalActions } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'
import TextField, { Field, PasswordField } from '@/components/ui/TextField'
import { toast, ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { checkPhoneVerifyCode, sendEmailChangeCode, sendPhoneVerifyCode, verifyPassword } from '@/lib/auth'
import { changeEmail, changePhone } from '@/lib/member'
import { formatPhone } from '@/components/login/signupSteps'
import { useHandleError } from '@/hooks/useHandleError'

type AccountField = 'email' | 'phone'

interface AccountEditModalProps {
  field: AccountField
  token: string
  /** 번호 변경 없이 기존 번호를 인증만 할 때 사용한다 */
  verifyOnlyPhone?: string
  onClose: () => void
  onDone: () => void
}

export default function AccountEditModal({ field, token, verifyOnlyPhone, onClose, onDone }: AccountEditModalProps) {
  const handleError = useHandleError()
  const isEmail = field === 'email'
  const isVerifyOnly = !!verifyOnlyPhone
  const label = isEmail ? '이메일' : '전화번호'

  // 인증만 하는 경우엔 비밀번호 단계를 건너뛴다
  const [step, setStep] = useState<'password' | 'verify'>(isVerifyOnly ? 'verify' : 'password')
  const [password, setPassword] = useState('')
  const [value, setValue] = useState(verifyOnlyPhone ? formatPhone(verifyOnlyPhone) : '')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  const phoneDigits = value.replace(/\D/g, '')
  const isValueValid = isEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) : /^010\d{8}$/.test(phoneDigits)
  const canSubmit = isVerifyOnly ? codeSent && code.trim() !== '' : isValueValid && codeSent && code.trim() !== ''

  async function handleCheckPassword() {
    if (password === '' || checkingPassword) return
    setCheckingPassword(true)
    try {
      if (!(await verifyPassword(token, password))) {
        toast.error('비밀번호가 일치하지 않습니다.')
        return
      }
      setStep('verify')
    } catch (e) {
      void handleError(e)
    } finally {
      setCheckingPassword(false)
    }
  }

  async function handleSendCode() {
    if (!isValueValid) return
    setSending(true)
    try {
      if (isEmail) await sendEmailChangeCode(value)
      else await sendPhoneVerifyCode(phoneDigits)
      setCodeSent(true)
      toast.success('인증번호를 발송했습니다.')
    } catch (e) {
      void handleError(e)
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    try {
      if (isVerifyOnly) {
        await checkPhoneVerifyCode(phoneDigits, code.trim())
        toast.success('전화번호 인증이 완료되었습니다.')
      } else if (isEmail) {
        await changeEmail(token, { password, newEmail: value, verifyCode: code.trim() })
        toast.success('이메일을 변경했습니다.')
      } else {
        await changePhone(token, { password, newPhone: phoneDigits, code: code.trim() })
        toast.success('전화번호를 변경했습니다.')
      }
      onDone()
    } catch (e) {
      void handleError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isVerifyOnly ? '전화번호 인증' : `${label} 변경`} closeOnBackdrop={false} onClose={onClose}>
      {step === 'password' ? (
        <>
          <Text size="sm" color={colors.zinc500}>
            본인 확인을 위해 현재 비밀번호를 입력해주세요.
          </Text>
          <PasswordField value={password} onChangeText={setPassword} placeholder="현재 비밀번호" autoFocus onSubmitEditing={() => void handleCheckPassword()} />
          <ModalActions>
            <Button variant="ghost" onPress={onClose}>
              취소
            </Button>
            <Button loading={checkingPassword} disabled={password === ''} onPress={() => void handleCheckPassword()}>
              {checkingPassword ? '확인 중...' : '다음'}
            </Button>
          </ModalActions>
        </>
      ) : (
        <>
          <Field label={isVerifyOnly ? '전화번호' : `새 ${label}`}>
            <View style={styles.row}>
              <TextField
                value={value}
                onChangeText={(v) => setValue(isEmail ? v : formatPhone(v))}
                placeholder={isEmail ? 'new@example.com' : '010-0000-0000'}
                keyboardType={isEmail ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
                editable={!isVerifyOnly}
                containerStyle={styles.flex}
              />
              <Button variant="secondary" loading={sending} disabled={!isValueValid} onPress={() => void handleSendCode()}>
                {sending ? '발송 중...' : codeSent ? '재발송' : '인증번호'}
              </Button>
            </View>
          </Field>
          {codeSent ? (
            <Field label="인증번호">
              <TextField value={code} onChangeText={setCode} placeholder="인증번호를 입력해주세요" keyboardType="number-pad" autoFocus />
            </Field>
          ) : null}
          <ModalActions>
            <Button variant="ghost" onPress={isVerifyOnly ? onClose : () => setStep('password')}>
              {isVerifyOnly ? '취소' : '이전'}
            </Button>
            <Button loading={saving} disabled={!canSubmit} onPress={() => void handleSubmit()}>
              {saving ? '처리 중...' : isVerifyOnly ? '인증' : '변경'}
            </Button>
          </ModalActions>
        </>
      )}
      {/* 모달은 별도 창이라 루트의 토스트가 가려진다. 여기서 일어난 오류·안내는 모달 위에 띄운다 */}
      <ToastHost />
    </Modal>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
})
