import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import type { LocalFile } from './file'

function nameFromUri(uri: string, fallback: string) {
  const last = uri.split('/').pop()?.split('?')[0]
  return last && last.includes('.') ? decodeURIComponent(last) : fallback
}

// 사진 고르기. 안드로이드 13 이상은 시스템 사진 선택기를 써서 저장소 권한을 따로 묻지 않는다
export async function pickImages({ multiple = true, limit }: { multiple?: boolean; limit?: number } = {}): Promise<LocalFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? limit ?? 0 : 1,
    // 압축은 업로드 직전(uploadFile)에 한 번만 한다. 여기서 또 줄이면 화질이 두 번 깎인다
    quality: 1,
  })
  if (result.canceled) return []
  return result.assets.map((asset, i) => ({
    uri: asset.uri,
    name: asset.fileName ?? nameFromUri(asset.uri, `image-${Date.now()}-${i}.jpg`),
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
  }))
}

// PDF 고르기. 백엔드가 이미지와 PDF 만 받아(Tika 로 MIME 검사) 다른 문서는 골라도 업로드가 거부된다
export async function pickPdf(): Promise<LocalFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false })
  if (result.canceled || !result.assets[0]) return null
  const asset = result.assets[0]
  return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size ?? null }
}
