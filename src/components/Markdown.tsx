import { useState, type ReactNode } from 'react'
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import Text from '@/components/ui/Text'
import { colors, radius } from '@/constants/theme'
import { toAbsoluteUrl } from '@/lib/file'

// 커뮤니티 글은 웹 마크다운 편집기(MDEditor)로 쓴다. 대부분 글·이미지·목록이라
// 무거운 렌더러를 들이지 않고 자주 쓰는 문법만 직접 그린다.
// - 웹처럼 한 문단 안의 이미지는 글 아래로 모아 240px 칸으로 나란히 둔다
// - 줄 하나만 바꾼 것은 웹(GFM)과 같이 공백으로 이어 붙인다. 문단을 나누려면 빈 줄이 필요하다

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[]; start: number }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'rule' }

const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const INLINE = /(\*\*|__)(.+?)\1|~~(.+?)~~|(\*|_)(?!\s)(.+?)\4|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*```/.test(line)) {
      flushParagraph()
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph()
      blocks.push({ type: 'rule' })
      continue
    }

    if (/^\s*>/.test(line)) {
      flushParagraph()
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      i--
      blocks.push({ type: 'quote', text: quote.join('\n') })
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/)
    if (bullet || ordered) {
      flushParagraph()
      const isOrdered = !!ordered
      const items: string[] = []
      const start = ordered ? Number(ordered[1]) : 1
      while (i < lines.length) {
        const m = isOrdered ? lines[i].match(/^\s*\d+[.)]\s+(.*)$/) : lines[i].match(/^\s*[-*+]\s+(.*)$/)
        if (!m) break
        items.push(m[1])
        i++
      }
      i--
      blocks.push({ type: 'list', ordered: isOrdered, items, start })
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    paragraph.push(line)
  }
  flushParagraph()
  return blocks
}

// 줄 끝 공백 두 개나 역슬래시는 강제 줄바꿈, 그 밖의 줄바꿈은 공백(GFM 소프트 줄바꿈)
function joinSoftBreaks(text: string) {
  // 강제 줄바꿈 자리에서 먼저 나눠 두고, 나머지 줄바꿈만 공백으로 바꾼다
  return text
    .split(/(?: {2,}|\\)\n/)
    .map((part) => part.replace(/\n/g, ' '))
    .join('\n')
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let n = 0
  while (rest.length > 0) {
    const match = rest.match(INLINE)
    if (!match || match.index === undefined) {
      nodes.push(rest)
      break
    }
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const key = `${keyPrefix}-${n++}`
    if (match[2] !== undefined) {
      nodes.push(
        <Text key={key} weight="bold" style={styles.inherit}>
          {renderInline(match[2], key)}
        </Text>,
      )
    } else if (match[3] !== undefined) {
      nodes.push(
        <Text key={key} style={[styles.inherit, styles.strike]}>
          {renderInline(match[3], key)}
        </Text>,
      )
    } else if (match[5] !== undefined) {
      nodes.push(
        <Text key={key} style={[styles.inherit, styles.italic]}>
          {renderInline(match[5], key)}
        </Text>,
      )
    } else if (match[6] !== undefined) {
      nodes.push(
        <Text key={key} style={[styles.inherit, styles.inlineCode]}>
          {match[6]}
        </Text>,
      )
    } else if (match[7] !== undefined) {
      const url = match[8]
      nodes.push(
        <Text key={key} color={colors.link} style={styles.inherit} onPress={() => void Linking.openURL(url).catch(() => {})}>
          {renderInline(match[7], key)}
        </Text>,
      )
    }
    rest = rest.slice(match.index + match[0].length)
  }
  return nodes
}

function MarkdownImage({ uri, onPress }: { uri: string; onPress?: (uri: string) => void }) {
  // 이미지 실제 비율을 알기 전에는 4:3 으로 자리를 잡아 두고, 불러오면 원본 비율로 맞춘다
  const [aspectRatio, setAspectRatio] = useState(4 / 3)
  return (
    <Pressable onPress={() => onPress?.(uri)} disabled={!onPress} style={styles.imageTile} accessibilityLabel="이미지 크게 보기">
      <Image
        source={{ uri: toAbsoluteUrl(uri) }}
        style={[styles.image, { aspectRatio }]}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={(e) => {
          const { width, height } = e.source
          if (width > 0 && height > 0) setAspectRatio(width / height)
        }}
      />
    </Pressable>
  )
}

function Paragraph({ text, onImagePress, index }: { text: string; onImagePress?: (uri: string) => void; index: number }) {
  const images = [...text.matchAll(IMAGE)].map((m) => m[2])
  const body = joinSoftBreaks(text.replace(IMAGE, '')).trim()
  return (
    <View style={styles.paragraph}>
      {body ? <Text style={styles.body}>{renderInline(body, `p${index}`)}</Text> : null}
      {images.length > 0 ? (
        <View style={styles.images}>
          {images.map((uri, i) => (
            <MarkdownImage key={`${uri}-${i}`} uri={uri} onPress={onImagePress} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

const HEADING_SIZE = [28, 22, 20, 17, 15, 14]

export default function Markdown({ source, onImagePress }: { source: string; onImagePress?: (uri: string) => void }) {
  const blocks = parseBlocks(source)

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text key={index} weight="semibold" style={{ fontSize: HEADING_SIZE[block.level - 1], lineHeight: HEADING_SIZE[block.level - 1] * 1.35 }}>
                {renderInline(block.text, `h${index}`)}
              </Text>
            )
          case 'paragraph':
            return <Paragraph key={index} index={index} text={block.text} onImagePress={onImagePress} />
          case 'list':
            return (
              <View key={index} style={styles.list}>
                {block.items.map((item, i) => (
                  <View key={i} style={styles.listItem}>
                    <Text style={styles.body}>{block.ordered ? `${block.start + i}.` : '•'}</Text>
                    <Text style={[styles.body, styles.flex]}>{renderInline(joinSoftBreaks(item), `l${index}-${i}`)}</Text>
                  </View>
                ))}
              </View>
            )
          case 'quote':
            return (
              <View key={index} style={styles.quote}>
                <Text style={styles.body} color={colors.zinc500}>
                  {renderInline(joinSoftBreaks(block.text), `q${index}`)}
                </Text>
              </View>
            )
          case 'code':
            return (
              <View key={index} style={styles.codeBlock}>
                <Text style={styles.codeText}>{block.text}</Text>
              </View>
            )
          case 'rule':
            return <View key={index} style={styles.rule} />
        }
      })}
    </View>
  )
}

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' })

const styles = StyleSheet.create({
  container: { gap: 16 },
  flex: { flex: 1 },
  body: { fontSize: 16, lineHeight: 25 },
  inherit: { fontSize: 16, lineHeight: 25 },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  inlineCode: { fontFamily: MONO, backgroundColor: colors.zinc100, fontSize: 14 },
  paragraph: { gap: 12 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  imageTile: { width: 240, borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%' },
  list: { gap: 4 },
  listItem: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  quote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.zinc300,
    paddingLeft: 12,
  },
  codeBlock: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.zinc100,
  },
  codeText: { fontFamily: MONO, fontSize: 13, lineHeight: 20 },
  rule: { height: 1, backgroundColor: colors.line },
})
