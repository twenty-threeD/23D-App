import { useState } from 'react'
import Modal, { ModalActions } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Text from '@/components/ui/Text'
import { Field, PasswordField } from '@/components/ui/TextField'
import { toast, ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { PASSWORD_REGEX } from '@/components/login/signupSteps'
import { changePassword, setPassword } from '@/lib/member'
import { ApiError } from '@/lib/apiError'
import { useHandleError } from '@/hooks/useHandleError'

interface PasswordModalProps {
  /** set: 비밀번호가 없는 계정의 최초 설정, change: 기존 비밀번호로 확인 후 변경 */
  mode: 'set' | 'change'
  token: string
  onClose: () => void
  /** change 성공 시엔 서버가 토큰을 지우므로, 호출한 쪽이 재로그인 처리를 해야 한다 */
  onDone: () => void
}

export default function PasswordModal({ mode, token, onClose, onDone }: PasswordModalProps) {
  const handleError = useHandleError()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const isChange = mode === 'change'
  const isInvalid = newPassword.length > 0 && !PASSWORD_REGEX.test(newPassword)
  const isMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canSubmit = (!isChange || currentPassword !== '') && PASSWORD_REGEX.test(newPassword) && newPassword === confirmPassword

  async function handleSubmit() {
    if (!canSubmit || saving) return
    setSaving(true)
    try {
      if (isChange) await changePassword(token, currentPassword, newPassword)
      else await setPassword(token, newPassword)
      toast.success(isChange ? '비밀번호를 변경했습니다. 다시 로그인해주세요.' : '비밀번호를 설정했습니다.')
      onDone()
    } catch (e) {
      // 기존 비밀번호가 틀려도 401 INVALID_CREDENTIALS 가 와서, 공통 처리에 넘기면 토큰 만료로 오인해 "다시 시도해주세요"만 뜬다
      if (e instanceof ApiError && e.code === 'INVALID_CREDENTIALS') {
        toast.error('기존 비밀번호가 일치하지 않습니다.')
        return
      }
      void handleError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isChange ? '비밀번호 재설정' : '비밀번호 설정'} closeOnBackdrop={false} onClose={onClose}>
      {!isChange ? (
        <Text size="sm" color={colors.zinc500}>
          소셜 로그인으로 가입한 계정은 비밀번호가 없어요. 비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있어요.
        </Text>
      ) : null}
      {isChange ? (
        <Field label="기존 비밀번호">
          <PasswordField value={currentPassword} onChangeText={setCurrentPassword} placeholder="기존 비밀번호를 입력해주세요" autoComplete="current-password" autoFocus />
        </Field>
      ) : null}
      <Field label="새 비밀번호" error={isInvalid ? '8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다' : null}>
        <PasswordField
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="새 비밀번호를 입력해주세요"
          autoComplete="new-password"
          autoFocus={!isChange}
          invalid={isInvalid}
        />
      </Field>
      <Field label="새 비밀번호 확인" error={isMismatch ? '비밀번호가 일치하지 않습니다' : null}>
        <PasswordField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="새 비밀번호를 다시 입력해주세요"
          autoComplete="new-password"
          invalid={isMismatch}
          onSubmitEditing={() => void handleSubmit()}
        />
      </Field>
      <ModalActions>
        <Button variant="ghost" onPress={onClose}>
          취소
        </Button>
        <Button loading={saving} disabled={!canSubmit} onPress={() => void handleSubmit()}>
          {saving ? '처리 중...' : isChange ? '변경' : '설정'}
        </Button>
      </ModalActions>
      {/* 모달은 별도 창이라 루트의 토스트가 가려진다. 여기서 일어난 오류·안내는 모달 위에 띄운다 */}
      <ToastHost />
    </Modal>
  )
}
