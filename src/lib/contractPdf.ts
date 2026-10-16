import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { Asset } from 'expo-asset'
import { File, Paths } from 'expo-file-system'
import type { ContractData } from './chatMessages'
import { contractArticles, formatContractDate, josa } from './contractDocument'
import { toAbsoluteUrl, type LocalFile } from './file'

// 웹 lib/contractPdf.ts 를 옮겼다. 화면을 찍지 않고 계약 내용을 그대로 텍스트 PDF 로 만든다

// A4 (pt)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 56

const INK = rgb(0.102, 0.153, 0.278) // colors.contract (#1A2747)
const BODY = rgb(0.12, 0.12, 0.14)
const MUTED = rgb(0.45, 0.45, 0.5)

// 나눔고딕(정적 TTF). pdf-lib 의 서브셋 기능은 한글 같은 대용량 CJK 폰트에서 글자를 대량으로 빠뜨려서
// 서브셋 없이 통째로 넣는다. 폰트 스트림이 압축되어 실제 PDF 는 1MB 아래로 나온다(웹과 같다)
const FONT_MODULE = require('@/assets/fonts/NanumGothic-Regular.ttf')
// 웹은 앱 아이콘을 캔버스로 검게 칠해 썼다. 앱은 미리 검게 만든 같은 그림을 쓴다
const WATERMARK_MODULE = require('@/assets/images/contract-watermark.png')

async function readAsset(module: number) {
  const asset = Asset.fromModule(module)
  await asset.downloadAsync()
  if (!asset.localUri) throw new Error('계약서 리소스를 불러오지 못했습니다.')
  return new File(asset.localUri).bytes()
}

// 2MB 짜리 파일이라 한 번 읽어서 재사용한다
let fontBytesPromise: Promise<Uint8Array> | null = null
function loadFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = readAsset(FONT_MODULE).catch((e: unknown) => {
      // 실패를 기억해 두면 다음 시도도 계속 실패하므로 지운다
      fontBytesPromise = null
      throw e
    })
  }
  return fontBytesPromise
}

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// 서명 이미지(방금 그린 data: URL 또는 업로드된 경로)를 PNG 바이트로 가져온다
async function fetchImageBytes(src: string): Promise<Uint8Array | null> {
  if (!src) return null
  try {
    if (src.startsWith('data:')) return base64ToBytes(src.slice(src.indexOf(',') + 1))
    const res = await fetch(toAbsoluteUrl(src))
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// 주어진 폭에 맞게 줄을 나눈다. 한글은 어절 단위로 끊되, 한 어절이 폭을 넘으면 글자 단위로 쪼갠다
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word
        continue
      }
      let chunk = ''
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          lines.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      line = chunk
    }
    lines.push(line)
  }
  return lines
}

/** 양쪽 서명이 담긴 계약서 PDF 를 만들어 캐시에 저장하고, 업로드할 수 있는 파일로 돌려준다 */
export async function buildContractPdf(data: ContractData): Promise<LocalFile> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(await loadFontBytes(), { subset: false })
  const watermark = await readAsset(WATERMARK_MODULE)
    .then((bytes) => doc.embedPng(bytes))
    .catch(() => null)

  const contentWidth = PAGE_WIDTH - MARGIN * 2
  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  function drawWatermark() {
    if (!watermark) return
    const width = 270
    const height = (watermark.height / watermark.width) * width
    const angle = Math.PI / 4
    const rotatedWidth = width * Math.cos(angle) - height * Math.sin(angle)
    const rotatedHeight = width * Math.sin(angle) + height * Math.cos(angle)
    page.drawImage(watermark, {
      x: PAGE_WIDTH / 2 - rotatedWidth / 2,
      y: PAGE_HEIGHT / 2 - rotatedHeight / 2,
      width,
      height,
      opacity: 0.09,
      rotate: degrees(45),
    })
  }

  drawWatermark()

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    y = PAGE_HEIGHT - MARGIN
    drawWatermark()
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage()
  }

  // Regular 폰트 하나만 넣으므로, 굵은 글씨는 미세하게 겹쳐 그려서 흉내낸다
  function drawText(text: string, x: number, yPos: number, size: number, color = BODY, bold = false) {
    page.drawText(text, { x, y: yPos, size, font, color })
    if (bold) page.drawText(text, { x: x + 0.35, y: yPos, size, font, color })
  }

  function drawParagraph(text: string, size: number, lineHeight: number, color = BODY) {
    for (const line of wrapText(text, font, size, contentWidth)) {
      ensureSpace(lineHeight)
      y -= lineHeight
      if (line) drawText(line, MARGIN, y, size, color)
    }
  }

  function centerText(text: string, size: number, color = INK, bold = false) {
    const width = font.widthOfTextAtSize(text, size)
    drawText(text, (PAGE_WIDTH - width) / 2, y, size, color, bold)
  }

  // 제목
  y -= 34
  centerText('용 역 계 약 서', 22, INK, true)
  y -= 30

  // 서두. 웹 PDF 는 조사를 '과'·'은' 으로 고정해 받침 없는 이름에서 어색해서, 작성 화면 미리보기처럼 받침에 맞춰 고른다
  drawParagraph(
    `${data.clientName}${josa(data.clientName, '과', '와')}(이하 '갑'이라 한다) ${data.professionalName}${josa(data.professionalName, '은', '는')}(이하 '을'이라 한다) ` +
      '아래 용역에 관하여 다음과 같이 계약을 체결한다.',
    10.5,
    17,
  )
  y -= 14

  for (const article of contractArticles(data)) {
    ensureSpace(46)
    y -= 18
    drawText(article.title, MARGIN, y, 11, INK, true)
    drawParagraph(article.body, 10, 16)
  }

  // 서명란은 잘리면 안 되므로 공간이 부족하면 새 페이지에서 시작한다
  // (날짜 34 + 26 + 라벨 16 + 성명 16 + 서명칸 62 ≒ 154)
  ensureSpace(158)
  y -= 34
  centerText(formatContractDate(data.startDate), 11, INK, true)
  y -= 26

  const [clientImg, professionalImg] = await Promise.all([fetchImageBytes(data.clientSig), fetchImageBytes(data.professionalSig)])

  const colWidth = (contentWidth - 28) / 2
  const blockTop = y
  const sigBoxHeight = 62
  const parties = [
    { label: '갑 (의뢰인)', name: data.clientName, image: clientImg },
    { label: '을 (수행자)', name: data.professionalName, image: professionalImg },
  ]

  for (const [index, party] of parties.entries()) {
    const x = MARGIN + index * (colWidth + 28)
    let cursor = blockTop
    page.drawLine({ start: { x, y: cursor }, end: { x: x + colWidth, y: cursor }, thickness: 1.4, color: INK })
    cursor -= 16
    drawText(party.label, x, cursor, 10.5, INK, true)
    cursor -= 16
    drawText(`성명(기업명)  ${party.name}`, x, cursor, 9.5, MUTED)
    cursor -= sigBoxHeight
    if (party.image) {
      try {
        const png = await doc.embedPng(party.image)
        const scale = Math.min(colWidth / png.width, sigBoxHeight / png.height, 1)
        page.drawImage(png, {
          x,
          y: cursor + (sigBoxHeight - png.height * scale) / 2,
          width: png.width * scale,
          height: png.height * scale,
        })
      } catch {
        // 서명 이미지를 못 읽으면 이름만 남긴다
      }
    }
  }

  const bytes = await doc.save()
  const name = `contract-${Date.now()}.pdf`
  const file = new File(Paths.cache, name)
  file.create({ overwrite: true })
  file.write(bytes)
  return { uri: file.uri, name, mimeType: 'application/pdf', size: bytes.length }
}

/** 방금 그린 서명(data: URL)을 업로드할 수 있는 PNG 파일로 저장한다 */
export function saveSignaturePng(dataUrl: string): LocalFile {
  const bytes = base64ToBytes(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const name = `contract-signature-${Date.now()}.png`
  const file = new File(Paths.cache, name)
  file.create({ overwrite: true })
  file.write(bytes)
  return { uri: file.uri, name, mimeType: 'image/png', size: bytes.length }
}
