import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type { LocalFile } from './file'

// 백엔드(FileService)가 받는 종류. Tika 로 MIME 을 판별해 확장자와 대조하므로
// 변환 후에는 파일명 확장자도 같이 바꿔야 한다.
const UPLOADABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const HEIF_TYPES = new Set(['image/heic', 'image/heif'])
const HEIF_EXTENSION = /\.(heic|heif)$/i

export class HeifConversionError extends Error {
  constructor(fileName: string) {
    super(`${fileName}: HEIF 사진을 업로드용 형식으로 변환하지 못했어요. JPG, PNG 또는 WEBP로 저장한 뒤 다시 선택해주세요.`)
    this.name = 'HeifConversionError'
  }
}

export function isHeifFile(file: Pick<LocalFile, 'name' | 'mimeType'>) {
  return HEIF_TYPES.has(file.mimeType.toLowerCase()) || HEIF_EXTENSION.test(file.name)
}

function isImage(file: LocalFile) {
  return file.mimeType.startsWith('image/') || isHeifFile(file)
}

// 업로드 전에 줄일 기준. 웹과 같다(서비스에서 쓰는 가장 큰 자리가 풀스크린 배너라 1600px 이면 충분하다)
const MAX_SIDE = 1600
const QUALITY = 0.8

function toWebpName(name: string) {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.webp`
}

/**
 * 이미지는 긴 변 1600px 이하 webp 로 줄이고, 그 외(PDF 등)는 그대로 돌려준다.
 *
 * 웹은 브라우저에서 HEIF 를 따로 JPEG 로 바꿨지만, 앱은 네이티브 디코더가 HEIF 를 읽으므로 한 번에 webp 로 바꾼다.
 * 압축이 실패해도 업로드 자체는 막지 않는다 — 백엔드가 받는 형식이면 원본으로 올리면 된다.
 */
export async function compressImage(file: LocalFile): Promise<LocalFile> {
  if (!isImage(file)) return file

  try {
    let image = await ImageManipulator.manipulate(file.uri).renderAsync()
    const longest = Math.max(image.width, image.height)
    if (longest > MAX_SIDE) {
      const scale = MAX_SIDE / longest
      image = await ImageManipulator.manipulate(image).resize({ width: Math.round(image.width * scale) }).renderAsync()
    }
    const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.WEBP })
    return { uri: saved.uri, name: toWebpName(file.name), mimeType: 'image/webp', width: saved.width, height: saved.height }
  } catch {
    // 백엔드가 받지 않는 형식(HEIF 등)을 원본으로 올리면 어차피 거부되므로 사용자에게 바로 알린다
    if (!UPLOADABLE.has(file.mimeType)) throw new HeifConversionError(file.name)
    return file
  }
}
