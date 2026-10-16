import { throwApiError } from './apiError'
import { API_URL } from './config'
import { apiUrl } from './http'
import { compressImage } from './imageCompress'

// 앱에서 고른 파일. 웹의 File 대신 기기 안의 경로(uri)를 들고 다닌다
export interface LocalFile {
  uri: string
  name: string
  mimeType: string
  size?: number | null
  width?: number
  height?: number
}

// 서버가 절대 URL(https://api.idta.store/files/…)로 준 값을 상대 경로로 바꾼다.
// 서버에 다시 보낼 때(게시글 fileUrls·프로필 imageUrl 등)는 웹과 같은 형식을 써야 해서 남겨 둔다
export function toRelativeUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith(API_URL)) return url.slice(API_URL.length)
  return url
}

// 화면에 그릴 때는 반드시 이 함수를 거친다. 웹은 상대 경로를 같은 오리진 프록시로 받았지만
// 앱에는 프록시가 없어 상대 경로 그대로는 이미지가 뜨지 않는다
export function toAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (/^(https?|data|file|content|blob):/i.test(url)) return url
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

// 프로필 imageUrl, 커뮤니티 글 fileUrl 은 서버가 우리 업로드 경로(/files/<파일명>)만 받고 외부 URL 은 400 으로 막는다.
// 서버가 절대 URL 로 내려준 값도 있어 상대 경로로 바꾼 뒤 확인하고, 형식이 아니면 null 을 돌려 보내지 않게 한다
export function toUploadPath(url: string | null | undefined): string | null {
  const path = toRelativeUrl(url)
  return /^\/files\/[^/?#]+$/.test(path) ? path : null
}

export function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url)
}

export function fileNameFromUrl(url: string) {
  try {
    const decoded = decodeURIComponent(url.split('/').pop() ?? '첨부파일')
    return decoded.replace(/^\d+[-_]/, '')
  } catch {
    return '첨부파일'
  }
}

interface UploadOptions {
  /**
   * 이미지를 줄이지 않고 원본 그대로 올린다.
   * 계약서 서명처럼 나중에 pdf-lib 의 embedPng 로 다시 읽는 파일은 PNG 를 유지해야 한다.
   */
  keepOriginal?: boolean
}

export async function uploadFile(token: string, file: LocalFile, options: UploadOptions = {}): Promise<{ url: string }> {
  // 이미지는 여기서 한 번에 줄인다. 업로드 경로가 전부 이 함수를 지나가므로
  // 채팅·프로필·커뮤니티·서비스 등록이 같은 기준을 쓰게 된다. (PDF 는 그대로 통과)
  const payload = options.keepOriginal ? file : await compressImage(file)

  const formData = new FormData()
  // RN FormData 는 { uri, name, type } 로 기기 안의 파일을 그대로 실어 보낸다
  formData.append('multipartFile', { uri: payload.uri, name: payload.name, type: payload.mimeType } as unknown as Blob)

  const res = await fetch(apiUrl('/api/files/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) await throwApiError(res)
  const json = await res.json()
  const fileUrl: string = json.data?.fileUrl ?? json.fileUrl ?? ''
  return { url: toRelativeUrl(fileUrl) }
}
