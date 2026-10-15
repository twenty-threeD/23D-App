import { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { colors, radius } from '@/constants/theme'
import { toAbsoluteUrl } from '@/lib/file'

const CANVAS_HEIGHT = 140

// 서명 패드 라이브러리가 그리는 기본 테두리·버튼을 걷는다. 버튼은 아래에 앱 버튼으로 따로 둔다
const WEB_STYLE = `
.m-signature-pad { box-shadow: none; border: none; margin: 0; width: 100%; height: 100%; }
.m-signature-pad--body { border: none; }
.m-signature-pad--footer { display: none; }
body, html { width: 100%; height: 100%; margin: 0; background: transparent; }
`

interface SignaturePadProps {
  label: string
  /** 확인한 서명(data: URL 또는 업로드된 경로). 있으면 그림을 보여주고 다시 서명할 수 있게 한다 */
  savedUrl?: string
  onSave: (dataUrl: string) => void
  /** 그리는 동안 바깥 스크롤을 멈추게 알린다. 멈추지 않으면 획을 긋다가 화면이 같이 움직인다 */
  onDrawingChange?: (drawing: boolean) => void
}

// 웹 chat/SignaturePad(react-signature-canvas). 같은 signature_pad 를 웹뷰 안에서 쓰는 라이브러리라 필기감이 웹과 같다
export default function SignaturePad({ label, savedUrl, onSave, onDrawingChange }: SignaturePadProps) {
  const ref = useRef<SignatureViewRef>(null)
  const [hasStroke, setHasStroke] = useState(false)

  function handleClear() {
    ref.current?.clearSignature()
    setHasStroke(false)
    onSave('')
  }

  return (
    <View style={styles.container}>
      <Text size="sm" weight="semibold" color={colors.zinc700}>
        {label} 서명
      </Text>
      {savedUrl ? (
        <View style={styles.group}>
          <View style={styles.savedBox}>
            <Image source={{ uri: toAbsoluteUrl(savedUrl) }} style={styles.savedImage} contentFit="contain" />
          </View>
          <Pressable onPress={handleClear} hitSlop={6} style={styles.retry}>
            <Text size="xs" color={colors.zinc400} style={styles.underline}>
              다시 서명
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.group}>
          <View style={styles.canvasBox}>
            <SignatureScreen
              ref={ref}
              webStyle={WEB_STYLE}
              // 투명 바탕이어야 계약서 PDF 의 워터마크 위에 흰 상자 없이 얹힌다
              backgroundColor="rgba(0,0,0,0)"
              penColor="#111827"
              // 기본값은 점을 많이 버려서 획이 각져 보인다(웹과 같은 설정)
              minDistance={1}
              minWidth={1}
              maxWidth={3}
              dotSize={1.5}
              // 여백을 잘라내야 계약서에 얹었을 때 서명이 작게 보이지 않는다
              trimWhitespace
              imageType="image/png"
              // 안드로이드는 획을 긋기 시작하자마자 바깥 스크롤이 터치를 가로채서, 스크롤을 끄라는 알림(onBegin)이 닿기 전에
              // 세로로 긋는 획이 끊긴다. 웹뷰가 터치를 잡으면 부모가 가로채지 못하게 한다
              nestedScrollEnabled
              onBegin={() => {
                setHasStroke(true)
                onDrawingChange?.(true)
              }}
              onEnd={() => onDrawingChange?.(false)}
              onOK={onSave}
              onEmpty={() => toast.info('서명을 먼저 그려주세요.')}
              style={styles.canvas}
            />
            {!hasStroke ? (
              <Text size="xs" color={colors.zinc300} align="center" style={styles.hint} pointerEvents="none">
                이곳에 서명해주세요
              </Text>
            ) : null}
          </View>
          <View style={styles.buttons}>
            <Button variant="secondary" size="sm" style={styles.flex} onPress={handleClear}>
              지우기
            </Button>
            <Button size="sm" style={styles.flex} onPress={() => ref.current?.readSignature()}>
              서명 확인
            </Button>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  group: { gap: 8 },
  flex: { flex: 1 },
  canvasBox: {
    height: CANVAS_HEIGHT,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  canvas: { flex: 1 },
  hint: { position: 'absolute', left: 0, right: 0, bottom: 8 },
  buttons: { flexDirection: 'row', gap: 8 },
  savedBox: {
    height: 128,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  savedImage: { flex: 1 },
  retry: { alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
})
