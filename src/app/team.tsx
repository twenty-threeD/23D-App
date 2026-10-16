import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import PageIntro from '@/components/PageIntro'
import { colors, PAGE_X, radius } from '@/constants/theme'

// 웹 /team 과 같은 목록이다. github 이 빈 문자열이면 버튼을 그리지 않는다
const MEMBERS = [
  { name: '김경윤', role: 'PM / FullStack / BlockChain', github: 'https://github.com/L98293' },
  { name: '권민기', role: 'BackEnd', github: 'https://github.com/gnlandkmg' },
  { name: '김승우', role: 'PM / BackEnd', github: 'https://github.com/Ze-rith' },
  { name: '김준현', role: 'FullStack / DBA', github: 'https://github.com/abcb-s' },
  { name: '이도건', role: 'FrontEnd / Design', github: 'https://github.com/16bit-16' },
  { name: '안재민', role: 'FrontEnd / Design', github: 'https://github.com/Mercel4' },
  { name: '이재원', role: '3D Modeling', github: 'https://github.com/amguangum' },
]

// 웹은 넓은 화면에서 3열로 놓고 PM 을 가운데 위에 둔다. 휴대폰은 한 줄에 한 명씩 같은 순서로 쌓는다
export default function Page() {
  return (
    <View style={styles.container}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <PageIntro kicker="MEET THE TEAM" title="팀원 소개" intro="잇다를 함께 만들고 있는 팀원들을 소개합니다." />
        <View style={styles.list} accessibilityLabel="잇다 팀원 목록">
          {MEMBERS.map((member) => (
            <View key={member.name} style={styles.member}>
              <View style={styles.nameRow}>
                <Text size="2xl" weight="bold" color={colors.zinc900} style={styles.name}>
                  {member.name}
                </Text>
                {member.github ? (
                  <Pressable
                    onPress={() => void Linking.openURL(member.github).catch(() => {})}
                    accessibilityLabel={`${member.name} GitHub`}
                    style={({ pressed }) => [styles.github, pressed && styles.githubPressed]}
                  >
                    {({ pressed }) => <Ionicons name="logo-github" size={18} color={pressed ? colors.main : colors.zinc600} />}
                  </Pressable>
                ) : null}
              </View>
              <Text size="sm" color={colors.zinc600}>
                {member.role}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  // 웹 팀원 소개만 바탕이 zinc-50 이다
  container: { flex: 1, backgroundColor: colors.zinc50 },
  content: { paddingHorizontal: PAGE_X, paddingTop: 24, paddingBottom: 56, gap: 40 },
  list: { gap: 40 },
  member: { minHeight: 112, justifyContent: 'center', gap: 8, paddingBottom: 20, borderBottomWidth: 2, borderBottomColor: colors.zinc900 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { letterSpacing: -0.6 },
  github: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  githubPressed: { borderColor: colors.main },
})
