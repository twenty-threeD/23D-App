import { useRef } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import BackHeader from '@/components/BackHeader'
import PageIntro from '@/components/PageIntro'
import { colors, PAGE_X, radius } from '@/constants/theme'

export type PolicyBlock =
  | { type: 'p'; text: string; muted?: boolean }
  /** 간격을 두고 이어지는 문단 묶음(웹 space-y-3). 조항의 ①②… 항목이 여기에 든다 */
  | { type: 'list'; items: string[] }
  /** 회색 바탕 상자(제공받는 자·문의처 등). '**이름**: 값' 형식으로 이름을 굵게 쓴다 */
  | { type: 'box'; rows: string[] }
  | { type: 'email'; address: string }

export interface PolicySection {
  id: string
  /** 목차에 보일 이름. 웹 목차가 조항 제목을 줄여 쓴 곳이 있어 따로 둔다 */
  label: string
  title: string
  blocks: PolicyBlock[]
}

export interface PolicyDocument {
  kicker: string
  title: string
  intro: string
  effectiveDate: string
  sections: PolicySection[]
  addendum: { title: string; text: string } | null
}

// '**굵게**' 만 지원한다. 웹 원문에서 굵은 글씨는 상자 안 항목 이름뿐이라 마크다운 전체를 들일 필요가 없다
function RichText({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <Text size="sm" color={muted ? colors.zinc400 : colors.zinc600} style={styles.body}>
      {text.split('**').map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} size="sm" weight="semibold" color={colors.zinc800} style={styles.body}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  )
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case 'p':
      return <RichText text={block.text} muted={block.muted} />
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <RichText key={item} text={item} />
          ))}
        </View>
      )
    case 'box':
      return (
        <View style={styles.box}>
          {block.rows.map((row) => (
            <RichText key={row} text={row} />
          ))}
        </View>
      )
    case 'email':
      return (
        <Pressable onPress={() => void Linking.openURL(`mailto:${block.address}`).catch(() => {})} hitSlop={6}>
          <Text size="sm" weight="semibold" color={colors.main} style={styles.body}>
            {block.address}
          </Text>
        </Pressable>
      )
  }
}

// 웹 /eula·/privateinfo 의 공통 틀. 웹은 넓은 화면에서 목차를 옆에 고정했지만, 휴대폰은 위에 두고 누르면 그 조항으로 내려간다
export default function PolicyScreen({ document }: { document: PolicyDocument }) {
  const scrollRef = useRef<ScrollView>(null)
  // 조항마다 스크롤 안에서의 위치. 목차를 누를 때만 읽는다
  const offsets = useRef<Record<string, number>>({})

  function scrollToSection(id: string) {
    const y = offsets.current[id]
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true })
  }

  return (
    <View style={styles.container}>
      <BackHeader />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <PageIntro kicker={document.kicker} title={document.title} intro={document.intro}>
          <Text size="xs" color={colors.zinc400} style={styles.effective}>
            {document.effectiveDate}
          </Text>
        </PageIntro>

        <View style={styles.contents}>
          <Text size="xs" weight="bold" color={colors.zinc400} style={styles.kicker}>
            CONTENTS
          </Text>
          <View style={styles.contentsList}>
            {document.sections.map((section) => (
              <Pressable key={section.id} onPress={() => scrollToSection(section.id)} hitSlop={4}>
                <Text size="sm" color={colors.zinc500}>
                  {section.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 조항은 스크롤 내용의 바로 아래 자식이어야 onLayout 의 y 가 스크롤 위치와 같아진다 */}
        {document.sections.map((section) => (
          <View
            key={section.id}
            onLayout={(e) => {
              offsets.current[section.id] = e.nativeEvent.layout.y
            }}
            style={styles.section}
          >
            <Text size="lg" weight="bold" color={colors.main}>
              {section.title}
            </Text>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </View>
        ))}

        {document.addendum ? (
          <View style={styles.addendum}>
            <Text size="sm" weight="semibold" color={colors.zinc700}>
              {document.addendum.title}
            </Text>
            <Text size="xs" color={colors.zinc400} style={styles.addendumText}>
              {document.addendum.text}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: PAGE_X, paddingTop: 24, paddingBottom: 56, gap: 40 },
  kicker: { letterSpacing: 0.4 },
  effective: { paddingTop: 8 },
  contents: { gap: 16 },
  contentsList: { gap: 12, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: colors.line },
  section: { gap: 12, paddingLeft: 20, borderLeftWidth: 2, borderLeftColor: colors.mainLine },
  // 웹 본문은 leading-7(28px)이라 기본 줄 높이(20px)보다 넉넉하다
  body: { lineHeight: 28 },
  list: { gap: 12 },
  box: { gap: 8, padding: 20, borderRadius: radius.xl, backgroundColor: colors.zinc50 },
  addendum: { gap: 8, paddingTop: 32, borderTopWidth: 1, borderTopColor: colors.line },
  addendumText: { lineHeight: 20 },
})
