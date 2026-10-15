import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import PageIntro from '@/components/PageIntro'
import { colors, PAGE_X } from '@/constants/theme'

type IconName = keyof typeof Ionicons.glyphMap

const GUIDE_ITEMS: { icon: IconName; eyebrow: string; title: string; description: string; href: Href; linkLabel: string }[] = [
  {
    icon: 'search-outline',
    eyebrow: 'EXPLORE',
    title: '능력자와 서비스 찾기',
    description: '카테고리와 검색을 이용해 원하는 서비스를 찾아보세요.',
    href: '/search',
    linkLabel: '서비스 찾아보기',
  },
  {
    icon: 'document-text-outline',
    eyebrow: 'OFFER',
    title: '나의 서비스 등록하기',
    description: '내가 가진 경험과 능력을 서비스로 소개하고 새로운 의뢰를 만나보세요.',
    href: '/upload',
    linkLabel: '서비스 등록하기',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    eyebrow: 'CONNECT',
    title: '문의하고 거래하기',
    description: '채팅으로 작업 범위와 일정을 협의한 뒤 안전하게 거래를 진행하세요.',
    href: '/chat',
    linkLabel: '채팅으로 이동',
  },
]

const POLICY_ITEMS: { title: string; description: string; href: Href }[] = [
  { title: '자주 묻는 질문', description: '서비스 이용 중 궁금한 점을 확인하세요.', href: '/faq' },
  { title: '개인정보처리방침', description: '개인정보의 이용과 보호 기준을 안내합니다.', href: '/privateinfo' },
  { title: '이용약관', description: '서비스 이용에 필요한 권리와 의무를 확인하세요.', href: '/eula' },
]

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text size="xs" weight="bold" color={colors.main} style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <Text size="xl" weight="bold" color={colors.zinc900}>
        {title}
      </Text>
    </View>
  )
}

// 웹 /docs. 웹은 넓은 화면에서 안내 카드 셋을 한 줄에 놓지만 휴대폰은 세로로 쌓는다
export default function Page() {
  return (
    <View style={styles.container}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <PageIntro
          kicker="ITDA DOCS"
          title="문서"
          intro="잇다를 처음 이용하는 분부터 서비스를 등록하는 분까지, 필요한 내용을 한곳에서 확인하세요."
        />

        <View style={styles.section}>
          <SectionHead eyebrow="GET STARTED" title="잇다 이용 가이드" />
          <View style={styles.cards}>
            {GUIDE_ITEMS.map((item) => (
              <Pressable
                key={item.title}
                // 탭 화면(능력자 찾기·채팅)은 새로 쌓지 않고 이미 있는 탭으로 돌아간다
                onPress={() => router.navigate(item.href)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.cardBody}>
                  <Ionicons name={item.icon} size={24} color={colors.main} />
                  <View style={styles.cardTexts}>
                    <Text size="xs" weight="bold" color={colors.zinc400} style={styles.eyebrow}>
                      {item.eyebrow}
                    </Text>
                    <Text size="lg" weight="bold" color={colors.zinc900}>
                      {item.title}
                    </Text>
                    <Text size="sm" color={colors.zinc500} style={styles.description}>
                      {item.description}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardLink}>
                  <Text size="sm" weight="semibold" color={colors.main}>
                    {item.linkLabel}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.main} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.topRule]}>
          <SectionHead eyebrow="REFERENCE" title="도움말 및 정책" />
          <View style={styles.policyList}>
            {POLICY_ITEMS.map((item, index) => (
              <Pressable
                key={item.title}
                onPress={() => router.push(item.href)}
                style={({ pressed }) => [styles.policyRow, index > 0 && styles.policyDivider, pressed && styles.policyPressed]}
              >
                <View style={styles.policyTexts}>
                  <Text size="sm" weight="semibold" color={colors.zinc800}>
                    {item.title}
                  </Text>
                  <Text size="sm" color={colors.zinc500}>
                    {item.description}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.zinc400} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: PAGE_X, paddingTop: 24, paddingBottom: 56, gap: 40 },
  section: { gap: 20 },
  topRule: { paddingTop: 40, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHead: { gap: 8 },
  eyebrow: { letterSpacing: 0.3 },
  cards: { gap: 16 },
  // 웹 카드는 라운드 없이 각진 테두리다
  card: { gap: 24, padding: 24, borderWidth: 1, borderColor: colors.line },
  cardPressed: { borderColor: colors.main, backgroundColor: colors.mainFaint },
  cardBody: { gap: 20 },
  cardTexts: { gap: 8 },
  description: { lineHeight: 24 },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  policyList: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  policyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 8, paddingVertical: 20 },
  policyDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  policyPressed: { backgroundColor: colors.zinc50 },
  policyTexts: { flex: 1, gap: 4 },
})
