import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import BackHeader from '@/components/BackHeader'
import { colors, PAGE_X } from '@/constants/theme'
import { SIGNIN_PATH } from '@/lib/navigation'

// 서버가 /oauth/fail?code=... 로 넘겨주는 실패 사유 (웹과 같은 문구)
const FAIL_MESSAGES: Record<string, string> = {
  OAUTH_PROVIDER_MISMATCH: '해당 이메일은 다른 방식으로 가입된 계정입니다. 기존 가입 수단으로 로그인해 주세요.',
  OAUTH_EMAIL_NOT_PROVIDED: '소셜 계정에서 이메일을 받지 못했어요. 이메일 제공에 동의한 뒤 다시 시도해 주세요.',
  // 카카오에서 이메일 인증을 하지 않은 기존 회원도 소셜 로그인이 막혀, 어디서 풀어야 하는지까지 알려준다
  OAUTH_EMAIL_NOT_VERIFIED: '소셜 계정의 이메일이 인증되지 않았어요. 카카오 등 소셜 계정에서 이메일 인증을 마친 뒤 다시 로그인해 주세요.',
  OAUTH_ACCOUNT_CONFLICT: '이 이메일은 이미 다른 소셜 계정과 연결되어 있어요. 처음 가입한 소셜 계정으로 로그인해 주세요.',
  WITHDRAWN_ACCOUNT: '탈퇴한 계정입니다.',
  // 교환 코드는 60초 1회용이라 로그인 후 오래 머물렀으면 만료된다
  INVALID_OAUTH_EXCHANGE_CODE: '로그인 시간이 만료되었어요. 다시 로그인해 주세요.',
}

export default function Page() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const message = (code && FAIL_MESSAGES[code]) || '다시 시도해주세요'

  return (
    <View style={styles.container}>
      <BackHeader />
      <View style={styles.body}>
        <Text size="2xl" weight="bold">
          로그인에 실패했어요 :(
        </Text>
        <Text weight="medium" color={colors.zinc400} align="center">
          {message}
        </Text>
        <Button onPress={() => router.replace(SIGNIN_PATH)}>다시하기</Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: PAGE_X,
  },
})
