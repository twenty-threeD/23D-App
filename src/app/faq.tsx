import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import PageIntro from '@/components/PageIntro'
import { colors, PAGE_X, radius } from '@/constants/theme'

const CONTACT_EMAIL = 'itda23d@gmail.com'

// 웹 /faq 의 문답. 웹은 서비스 등록 위치를 '상단 메뉴'로 안내하지만 앱은 하단 탭이라 그 문구만 바꿨다
const FAQ_ITEMS: { question: string; answer: string; email?: string }[] = [
  {
    question: '잇다는 어떤 서비스인가요?',
    answer:
      '잇다는 자신의 경험과 능력을 서비스로 등록하고, 필요한 능력자를 찾아 연결될 수 있는 플랫폼입니다. 서비스 탐색부터 문의, 채팅, 거래까지 한 곳에서 이용할 수 있습니다.',
  },
  {
    question: '서비스를 이용하려면 회원가입이 필요한가요?',
    answer:
      '서비스를 둘러보는 것은 회원가입 없이도 가능합니다. 다만 채팅, 서비스 등록, 결제 등 일부 기능은 회원가입과 로그인이 필요합니다.',
  },
  {
    question: '서비스를 등록하려면 어떻게 해야 하나요?',
    answer:
      '로그인 후 하단 메뉴의 ‘서비스 등록’을 선택해 서비스 제목, 설명, 가격과 관련 이미지를 입력하면 됩니다. 등록한 서비스는 검토 후 다른 이용자에게 공개됩니다.',
  },
  {
    question: '등록된 능력자에게 어떻게 문의하나요?',
    answer:
      '관심 있는 서비스 상세 페이지에서 문의를 시작할 수 있습니다. 채팅을 통해 작업 범위, 일정, 비용 등을 충분히 협의한 뒤 거래를 진행해 주세요.',
  },
  {
    question: '결제와 환불은 어떻게 진행되나요?',
    answer:
      '결제는 서비스 상세 내용과 결제 화면에 안내된 절차에 따라 진행됩니다. 환불이 필요한 경우 거래 상대방과 먼저 내용을 확인한 뒤 결제 관련 문의처로 접수해 주세요.',
  },
  {
    question: '계정이나 개인정보를 수정하고 싶어요.',
    answer:
      '로그인 후 프로필 메뉴에서 수정할 수 있습니다. 개인정보처리방침에 따라 개인정보 관련 열람·수정·삭제 요청은 문의 이메일로 접수할 수 있습니다.',
  },
  {
    question: '이름(실명)은 어떻게 변경하나요?',
    answer: '고객센터에 문의해주세요.',
  },
  {
    question: '서비스 이용 중 문제가 생기면 어디로 문의하나요?',
    answer: '이용 중 불편한 점이나 제휴 문의는 아래 이메일로 보내주세요. 문의 내용을 자세히 남겨주시면 확인 후 답변드리겠습니다.',
    email: CONTACT_EMAIL,
  },
]

export default function Page() {
  // 웹처럼 첫 질문을 펼친 채로 시작하고, 한 번에 하나만 펼친다
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <View style={styles.container}>
      <BackHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <PageIntro kicker="ITDA HELP" title="자주 묻는 질문" intro="잇다 서비스를 이용하면서 자주 궁금해하는 내용을 모았습니다." />

        <View style={styles.list} accessibilityLabel="자주 묻는 질문 목록">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <View key={item.question} style={index > 0 && styles.divider}>
                <Pressable
                  onPress={() => setOpenIndex(isOpen ? -1 : index)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => [styles.question, (isOpen || pressed) && styles.questionOpen]}
                >
                  <Text size="sm" weight="semibold" color={isOpen ? colors.main : colors.zinc800} style={styles.questionText}>
                    <Text size="xs" weight="bold" color={colors.zinc400}>
                      Q{String(index + 1).padStart(2, '0')}
                      {'   '}
                    </Text>
                    {item.question}
                  </Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={isOpen ? colors.main : colors.zinc400} />
                </Pressable>
                {isOpen ? (
                  <View style={styles.answer}>
                    <Text size="sm" color={colors.zinc600} style={styles.answerText}>
                      {item.answer}
                    </Text>
                    {item.email ? (
                      <Pressable onPress={() => void Linking.openURL(`mailto:${item.email}`).catch(() => {})} hitSlop={6}>
                        <Text size="sm" weight="semibold" color={colors.main}>
                          {item.email}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: PAGE_X, paddingTop: 24, paddingBottom: 56, gap: 40 },
  list: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, overflow: 'hidden' },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 20 },
  questionOpen: { backgroundColor: colors.mainFaint },
  questionText: { flex: 1 },
  answer: { gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: colors.mainSoft },
  // 웹 답변은 leading-7(28px)
  answerText: { lineHeight: 28 },
})
