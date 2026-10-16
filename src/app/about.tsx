import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, type Href } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import { colors, PAGE_X } from '@/constants/theme'

type IconName = keyof typeof Ionicons.glyphMap

const STEPS: { number: string; title: string; description: string; icon: IconName }[] = [
  {
    number: '01',
    title: '필요한 능력을 찾습니다',
    description: '카테고리와 검색을 통해 지금 필요한 서비스와 능력자를 발견합니다.',
    icon: 'search-outline',
  },
  {
    number: '02',
    title: '대화로 조건을 맞춥니다',
    description: '채팅으로 작업 범위, 일정, 비용을 직접 확인하고 서로의 기대를 맞춥니다.',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    number: '03',
    title: '안심하고 거래합니다',
    description: '결제와 거래 기록을 바탕으로 약속한 서비스를 진행하고 결과를 남깁니다.',
    icon: 'checkmark-circle-outline',
  },
]

const FEATURES: { title: string; description: string; icon: IconName }[] = [
  {
    title: '능력과 서비스의 발견',
    description: '이사·청소부터 외주, 과외, 자동차까지 다양한 카테고리에서 필요한 서비스를 찾을 수 있습니다.',
    icon: 'people-outline',
  },
  {
    title: '프로필 기반의 신뢰',
    description: '서비스를 제공하는 사람의 프로필과 커리어를 확인하고 나에게 맞는 파트너를 선택할 수 있습니다.',
    icon: 'shield-checkmark-outline',
  },
  {
    title: '대화에서 결제까지',
    description: '문의와 협의는 채팅으로, 결제는 Toss Payments로 이어져 거래 과정을 한곳에서 관리합니다.',
    icon: 'chatbubble-ellipses-outline',
  },
  {
    title: '블록체인 기반 검증',
    description: '결제 기록과 거래 정보를 블록체인과 연결해 활동을 더 투명하게 확인할 수 있도록 설계했습니다.',
    icon: 'link-outline',
  },
]

// 웹 about 의 각진 링크 버튼. 채운 것(주요)과 테두리만 있는 것(보조) 두 가지다
function LinkButton({ label, href, primary = false }: { label: string; href: Href; primary?: boolean }) {
  const color = primary ? colors.white : colors.zinc700
  return (
    <Pressable
      // 탭 화면(능력자 찾기)은 새로 쌓지 않고 이미 있는 탭으로 돌아간다
      onPress={() => router.navigate(href)}
      style={({ pressed }) => [
        styles.linkButton,
        primary ? styles.linkPrimary : styles.linkSecondary,
        pressed && (primary ? styles.linkPrimaryPressed : styles.linkSecondaryPressed),
      ]}
    >
      <Text size="sm" weight="semibold" color={color}>
        {label}
      </Text>
      <Ionicons name="arrow-forward" size={14} color={color} />
    </Pressable>
  )
}

function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text size="xs" weight="bold" color={colors.main} style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <Text size="2xl" weight="bold" color={colors.zinc900}>
        {title}
      </Text>
      {children ? (
        <Text size="sm" color={colors.zinc400}>
          {children}
        </Text>
      ) : null}
    </View>
  )
}

// 웹 /about(프로젝트 소개). 랜딩 페이지는 옮기지 않지만, 푸터에서 여는 소개 화면이라 옮긴다
export default function Page() {
  return (
    <View style={styles.container}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.block, styles.hero]}>
          <Text size="sm" weight="bold" color={colors.main} style={styles.eyebrow}>
            ABOUT ITDA
          </Text>
          <Text size="4xl" weight="bold" color={colors.zinc900} style={styles.heroTitle}>
            사람과 사람을{'\n'}
            <Text size="4xl" weight="bold" color={colors.main} style={styles.heroTitle}>
              잇다.
            </Text>
          </Text>
          <Text color={colors.zinc600} style={styles.heroText}>
            잇다는 자신의 경험과 능력을 서비스로 나누는 사람과, 믿을 수 있는 파트너가 필요한 사람을 연결하는 매칭 플랫폼입니다.
          </Text>
          <View style={styles.buttons}>
            <LinkButton label="서비스 찾아보기" href="/search" primary />
            <LinkButton label="이용 안내 보기" href="/docs" />
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.sectionHead}>
            <Text size="xs" weight="bold" color={colors.main} style={styles.eyebrow}>
              WHY ITDA
            </Text>
            <Text size="2xl" weight="bold" color={colors.zinc900} style={styles.whyTitle}>
              좋은 연결은{'\n'}신뢰에서 시작됩니다.
            </Text>
          </View>
          <View style={styles.paragraphs}>
            <Text size="sm" color={colors.zinc600} style={styles.paragraph}>
              누군가에게는 분명한 실력과 경험이 있어도 그것을 필요한 사람에게 알릴 기회가 부족합니다. 반대로 도움이 필요한 사람은 수많은 정보 속에서 누구를 믿고
              선택해야 할지 고민합니다.
            </Text>
            <Text size="sm" color={colors.zinc600} style={styles.paragraph}>
              잇다는 이 간격을 줄이기 위해 만들어졌습니다. 능력자는 자신이 잘하는 일을 소개하고, 이용자는 필요한 서비스를 비교하며, 두 사람은 충분한 대화를 거쳐
              함께 일을 시작합니다.
            </Text>
          </View>
        </View>

        <View style={styles.block}>
          <SectionHead eyebrow="HOW IT WORKS" title="잇다에서 연결되는 방법">
            찾고, 대화하고, 거래합니다.
          </SectionHead>
          <View style={styles.cards}>
            {STEPS.map((step) => (
              <View key={step.number} style={styles.stepCard}>
                <View style={styles.stepTop}>
                  <Text size="sm" weight="bold" color={colors.main}>
                    {step.number}
                  </Text>
                  <Ionicons name={step.icon} size={24} color={colors.zinc400} />
                </View>
                <View style={styles.stepTexts}>
                  <Text size="lg" weight="bold" color={colors.zinc900}>
                    {step.title}
                  </Text>
                  <Text size="sm" color={colors.zinc500} style={styles.description}>
                    {step.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <SectionHead eyebrow="WHAT WE BUILD" title="잇다가 제공하는 경험" />
          <View style={styles.features}>
            {FEATURES.map((feature) => (
              <View key={feature.title} style={styles.feature}>
                <Ionicons name={feature.icon} size={24} color={colors.main} style={styles.featureIcon} />
                <View style={styles.featureTexts}>
                  <Text size="lg" weight="bold" color={colors.zinc900}>
                    {feature.title}
                  </Text>
                  <Text size="sm" color={colors.zinc500} style={styles.description}>
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.block, styles.lastBlock]}>
          <SectionHead eyebrow="START WITH ITDA" title="나에게 필요한 연결을 시작해보세요." />
          <View style={styles.buttons}>
            <LinkButton label="능력자 찾기" href="/search" primary />
            <LinkButton label="팀원 소개" href="/team" />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: PAGE_X, paddingTop: 24, paddingBottom: 24 },
  // 웹처럼 구역마다 아래 구분선을 긋고 위아래 여백(py-12)을 둔다
  block: { gap: 32, paddingVertical: 48, borderBottomWidth: 1, borderBottomColor: colors.line },
  lastBlock: { gap: 16, borderBottomWidth: 0 },
  hero: { gap: 16, paddingTop: 0, paddingBottom: 32 },
  eyebrow: { letterSpacing: 0.3 },
  heroTitle: { letterSpacing: -0.9, lineHeight: 44 },
  heroText: { lineHeight: 32, paddingTop: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 16 },
  // 웹 버튼은 라운드 없이 각지다
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  linkPrimary: { backgroundColor: colors.main },
  linkPrimaryPressed: { backgroundColor: colors.mainPressed },
  linkSecondary: { borderWidth: 1, borderColor: colors.line },
  linkSecondaryPressed: { borderColor: colors.main },
  sectionHead: { gap: 12 },
  whyTitle: { lineHeight: 32 },
  paragraphs: { gap: 20 },
  // 웹 본문은 leading-7(28px)
  paragraph: { lineHeight: 28 },
  cards: { gap: 16 },
  stepCard: { minHeight: 224, padding: 24, gap: 48, borderWidth: 1, borderColor: colors.line },
  stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepTexts: { gap: 8 },
  description: { lineHeight: 24 },
  features: { gap: 40 },
  feature: { flexDirection: 'row', gap: 16 },
  featureIcon: { paddingTop: 4 },
  featureTexts: { flex: 1, gap: 8 },
})
