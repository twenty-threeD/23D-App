import { useState, type Dispatch, type SetStateAction } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import ImageLightbox from '@/components/ImageLightbox'
import FieldLabel from '@/components/upload/FieldLabel'
import { colors, PAGE_X, radius } from '@/constants/theme'
import { toAbsoluteUrl, uploadFile, type LocalFile } from '@/lib/file'
import { pickImages } from '@/lib/pickers'
import { HeifConversionError } from '@/lib/imageCompress'
import { isPayloadTooLarge } from '@/lib/apiError'
import { useAuthStore } from '@/store/authStore'

// 백엔드는 게시글당 이미지를 헤더 포함 최대 6장까지 받는다.
// 헤더가 필수라 한 장을 항상 차지하므로 메인·상세 이미지는 5장까지만 허용한다
const MAX_POST_IMAGES = 6
const MAX_CONTENT_IMAGES = MAX_POST_IMAGES - 1
const MAX_FILE_SIZE = 25 * 1024 * 1024
const THUMB_GAP = 8

function split(urls: string[]) {
  return { header: urls[0] ?? '', images: urls.slice(1, MAX_CONTENT_IMAGES + 1) }
}

// 0번 칸은 항상 헤더 자리로 둔다. 헤더 없이 메인만 올렸을 때 앞으로 당기면
// 첫 메인 이미지가 헤더로 취급돼 등록 시 헤더 누락 검사를 통과해버린다
function compose(header: string, images: string[]) {
  return images.length > 0 || header ? [header, ...images] : []
}

function uploadErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HeifConversionError) return error.message
  if (isPayloadTooLarge(error)) return '사진은 최대 25MB까지 업로드할 수 있어요.'
  return fallback
}

function isValidSize(file: LocalFile) {
  if (file.size != null && file.size > MAX_FILE_SIZE) {
    toast.error(`${file.name}: 사진은 최대 25MB까지 업로드할 수 있어요.`)
    return false
  }
  return true
}

interface UploadImagesProps {
  /** 서버에 저장되는 순서: 헤더 이미지, 메인 이미지, 나머지 이미지 */
  value: string[]
  /**
   * 상태 세터를 그대로 받는다. 헤더와 메인·상세 업로드가 동시에 끝날 수 있어,
   * 먼저 끝난 쪽의 결과를 나중 쪽이 오래된 값으로 덮지 않게 항상 최신 값에 이어 붙인다
   */
  onChange: Dispatch<SetStateAction<string[]>>
}

// 웹 write/UploadPicture. 웹은 썸네일을 끌어서 순서를 바꿨지만, 휴대폰에선 스크롤과 끌기가 겹쳐
// 사진을 고른 뒤 화살표 버튼으로 한 칸씩 옮긴다
export default function UploadImages({ value, onChange }: UploadImagesProps) {
  const { width } = useWindowDimensions()
  const thumbSize = Math.min(72, (width - PAGE_X * 2 - THUMB_GAP * (MAX_CONTENT_IMAGES - 1)) / MAX_CONTENT_IMAGES)
  const { header, images } = split(value)
  // 업로드 중 여부를 영역별로 나눈다. 하나로 공유하면 헤더만 올려도 메인 칸에 스피너가 돌아 메인이 올라가는 중으로 오해한다
  const [headerUploading, setHeaderUploading] = useState(false)
  const [contentUploading, setContentUploading] = useState(false)
  const [selected, setSelected] = useState(0)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const current = Math.min(selected, Math.max(images.length - 1, 0))
  const bigImage = images[current]

  async function handlePickHeader() {
    const token = useAuthStore.getState().accessToken
    if (!token || headerUploading) return
    const [file] = await pickImages({ multiple: false })
    if (!file || !isValidSize(file)) return
    setHeaderUploading(true)
    try {
      const { url } = await uploadFile(token, file)
      onChange((prev) => compose(url, split(prev).images))
    } catch (e) {
      toast.error(uploadErrorMessage(e, '헤더 이미지 업로드에 실패했습니다.'))
    } finally {
      setHeaderUploading(false)
    }
  }

  async function handlePickContent() {
    const token = useAuthStore.getState().accessToken
    if (!token || contentUploading) return
    const available = MAX_CONTENT_IMAGES - images.length
    if (available <= 0) {
      toast.warning(`메인 및 상세 이미지는 최대 ${MAX_CONTENT_IMAGES}장까지 업로드할 수 있어요.`)
      return
    }
    const files = (await pickImages({ multiple: true, limit: available })).filter(isValidSize)
    if (files.length === 0) return
    // 오래된 안드로이드의 사진 선택기는 고를 수 있는 장수 제한을 무시하기도 한다
    if (files.length > available) toast.warning(`메인 및 상세 이미지는 최대 ${MAX_CONTENT_IMAGES}장까지 업로드할 수 있어요.`)

    setContentUploading(true)
    try {
      for (const file of files.slice(0, available)) {
        const { url } = await uploadFile(token, file)
        // 한 장씩 바로 붙인다. 여러 장 중 하나가 실패해도 먼저 올라간 사진은 남는다
        onChange((prev) => {
          const { header: h, images: list } = split(prev)
          return compose(h, [...list, url].slice(0, MAX_CONTENT_IMAGES))
        })
      }
    } catch (e) {
      toast.error(uploadErrorMessage(e, '이미지 업로드에 실패했습니다.'))
    } finally {
      setContentUploading(false)
    }
  }

  function removeImage(index: number) {
    setSelected(0)
    onChange((prev) => {
      const { header: h, images: list } = split(prev)
      return compose(h, list.filter((_, i) => i !== index))
    })
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return
    onChange((prev) => {
      const { header: h, images: list } = split(prev)
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return compose(h, next)
    })
    // 고른 사진을 따라가야 같은 사진을 연달아 옮길 수 있다
    setSelected(to)
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <FieldLabel essential>헤더 이미지</FieldLabel>
        <View>
          <Pressable
            onPress={() => (header ? setLightboxSrc(header) : void handlePickHeader())}
            disabled={headerUploading}
            accessibilityLabel={header ? '헤더 이미지 크게 보기' : '헤더 이미지 업로드'}
            style={styles.headerBox}
          >
            {header ? (
              <Image source={{ uri: toAbsoluteUrl(header) }} style={styles.fill} contentFit="cover" />
            ) : (
              <Text size="sm" weight="medium" color={colors.inkHint}>
                {headerUploading ? '업로드 중...' : '헤더 이미지를 업로드 해주세요.'}
              </Text>
            )}
            {headerUploading && header ? (
              <View style={styles.spinner}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </Pressable>
          {header ? (
            <View style={styles.headerActions}>
              {/* 바꾸려면 지우고 다시 올려야 했던 웹과 달리, 누르면 크게 보기라 바꾸기 버튼을 따로 둔다 */}
              <Pressable onPress={() => void handlePickHeader()} disabled={headerUploading} hitSlop={6} accessibilityLabel="헤더 이미지 바꾸기" style={styles.roundButton}>
                <Ionicons name="swap-horizontal" size={14} color={colors.white} />
              </Pressable>
              <Pressable onPress={() => onChange((prev) => compose('', split(prev).images))} hitSlop={6} accessibilityLabel="헤더 이미지 삭제" style={styles.roundButton}>
                <Ionicons name="close" size={14} color={colors.white} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <FieldLabel
          essential
          aside={
            <Text size="xs" weight="medium" color={colors.inkHint}>
              {images.length}/{MAX_CONTENT_IMAGES}
            </Text>
          }
        >
          메인 및 상세 이미지
        </FieldLabel>
        <View style={styles.contentGroup}>
          <Pressable
            onPress={() => (bigImage ? setLightboxSrc(bigImage) : void handlePickContent())}
            accessibilityLabel={bigImage ? '메인 이미지 크게 보기' : '메인 이미지 업로드'}
            style={styles.bigBox}
          >
            {bigImage ? (
              <Image source={{ uri: toAbsoluteUrl(bigImage) }} style={styles.fill} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="image-outline" size={36} color={colors.inkHint} />
                <Text weight="medium" color={colors.inkHint}>
                  {contentUploading ? '업로드 중...' : '사진을 업로드 해주세요.'}
                </Text>
              </>
            )}
            {contentUploading && bigImage ? (
              <View style={styles.spinner}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </Pressable>

          <View style={styles.thumbs}>
            {Array.from({ length: MAX_CONTENT_IMAGES }).map((_, i) => {
              const url = images[i]
              const active = !!url && i === current
              return (
                <Pressable
                  key={i}
                  onPress={() => (url ? setSelected(i) : void handlePickContent())}
                  accessibilityLabel={url ? `이미지 ${i + 1} 보기` : '이미지 추가'}
                  style={[
                    styles.thumb,
                    { width: thumbSize, height: thumbSize },
                    active ? styles.thumbActive : i === 0 && url ? styles.thumbMain : null,
                  ]}
                >
                  {url ? (
                    <>
                      <Image source={{ uri: toAbsoluteUrl(url) }} style={styles.fill} contentFit="cover" />
                      {i === 0 ? (
                        <View style={styles.mainBadge}>
                          <Text weight="semibold" color={colors.white} style={styles.mainBadgeText}>
                            메인
                          </Text>
                        </View>
                      ) : null}
                      <Pressable onPress={() => removeImage(i)} hitSlop={6} accessibilityLabel={`이미지 ${i + 1} 삭제`} style={styles.thumbRemove}>
                        <Ionicons name="close" size={12} color={colors.white} />
                      </Pressable>
                    </>
                  ) : i === images.length ? (
                    contentUploading ? (
                      <ActivityIndicator color={colors.inkHint} />
                    ) : (
                      <Ionicons name="add" size={22} color={colors.inkMuted} />
                    )
                  ) : null}
                </Pressable>
              )
            })}
          </View>

          {images.length > 1 ? (
            <View style={styles.reorder}>
              <Button variant="secondary" size="sm" disabled={current === 0} onPress={() => move(current, current - 1)}>
                앞으로
              </Button>
              <Button variant="secondary" size="sm" disabled={current === images.length - 1} onPress={() => move(current, current + 1)}>
                뒤로
              </Button>
              <Button variant="secondary" size="sm" disabled={current === 0} onPress={() => move(current, 0)}>
                메인으로
              </Button>
            </View>
          ) : null}
          {images.length > 0 ? (
            <Text size="xs" color={colors.inkHint}>
              첫 번째 이미지가 메인 이미지로 사용됩니다. 사진을 누른 뒤 버튼으로 순서를 바꿀 수 있어요.
            </Text>
          ) : null}
        </View>
      </View>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 40 },
  section: { gap: 14 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerBox: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.zinc50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerActions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roundButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  contentGroup: { gap: 16 },
  bigBox: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.zinc50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  thumbs: { flexDirection: 'row', gap: THUMB_GAP },
  thumb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.zinc50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  thumbMain: { borderColor: colors.main },
  thumbActive: { borderColor: colors.main, borderWidth: 2 },
  mainBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.main,
  },
  mainBadgeText: { fontSize: 10, lineHeight: 14 },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorder: { flexDirection: 'row', gap: 8 },
})
