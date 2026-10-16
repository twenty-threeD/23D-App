import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Text from '@/components/ui/Text'
import AuthCard from '@/components/login/AuthCard'
import SubmitButton from '@/components/login/SubmitButton'
import { InputData, InputEmail, InputPhone, TermsAgreement, type SignUpFormData } from '@/components/login/signupSteps'
import { toast } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { signup } from '@/lib/auth'
import { ApiError } from '@/lib/apiError'
import { SIGNIN_PATH } from '@/lib/navigation'

const ACCENT = '#FF884D'

export default function Page() {
  const [step, setStep] = useState(1)
  const [isWaiting, setIsWaiting] = useState(false)
  const [formData, setFormData] = useState<SignUpFormData>({
    name: '',
    username: '',
    email: '',
    emailVerification: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    phoneVerification: '',
  })

  const next = () => setStep((prev) => prev + 1)

  async function handleSignup() {
    setIsWaiting(true)
    try {
      await signup(formData.name, formData.username, formData.email, formData.password, formData.phone)
      toast.success('회원가입에 성공했습니다. 로그인 페이지로 이동합니다.')
      // 가입 완료 후 뒤로가기로 가입 폼에 돌아오지 않도록 치환한다
      router.replace(SIGNIN_PATH)
    } catch (e) {
      toast.error(e instanceof Error ? `회원가입에 실패하였습니다. ${e.message}` : '회원가입에 실패했습니다.')
      // 이메일 인증은 가입 한 번에 소비되고 30분이 지나면 만료되므로, 가입이 실패하면 인증부터 다시 받아야 한다.
      // 인증이 문제면 인증 단계로, 그 밖의 실패(아이디 중복 등)는 입력부터 고치도록 정보 입력 단계로 돌려보낸다
      setFormData((prev) => ({ ...prev, emailVerification: '' }))
      setStep(e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED' ? 3 : 2)
    } finally {
      setIsWaiting(false)
    }
  }

  return (
    <AuthCard>
      <View style={styles.body}>
        {step === 1 ? (
          <>
            <Text size="lg" weight="bold" align="center">
              잠깐, 이용하기 전에 동의가 필요해요
            </Text>
            <TermsAgreement onNext={next} />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Text size="lg" weight="bold" align="center">
              회원가입 절차를 시작할게요
            </Text>
            <InputData formData={formData} setFormData={setFormData} onNext={next} />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Text size="lg" weight="bold" align="center">
              시작하기전,{' '}
              <Text size="lg" weight="bold" color={ACCENT}>
                이메일 인증
              </Text>
              이 필요해요
            </Text>
            <InputEmail formData={formData} setFormData={setFormData} onNext={next} />
          </>
        ) : null}
        {step === 4 ? (
          <>
            <Text size="lg" weight="bold" align="center">
              사람들과{' '}
              <Text size="lg" weight="bold" color={ACCENT}>
                채팅을 하기 위해서
              </Text>
              는{'\n'}
              <Text size="lg" weight="bold" color={ACCENT}>
                전화번호
              </Text>
              가 필요해요
            </Text>
            <InputPhone formData={formData} setFormData={setFormData} onNext={next} />
          </>
        ) : null}
        {step === 5 ? (
          <>
            <Text size="lg" weight="bold" align="center">
              {formData.name || formData.username}님, 이제
              <Text size="lg" weight="bold" color={ACCENT}>
                {' '}
                사람과 사람을 이으러{' '}
              </Text>
              가볼까요?
            </Text>
            <View style={styles.finish}>
              <SubmitButton label={isWaiting ? '처리 중...' : '시작하기'} enabled={!isWaiting} onPress={() => void handleSignup()} />
            </View>
          </>
        ) : null}
        <Text size="xs" color={colors.zinc400}>
          {step} / 5
        </Text>
      </View>
    </AuthCard>
  )
}

const styles = StyleSheet.create({
  body: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  finish: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 40,
  },
})
