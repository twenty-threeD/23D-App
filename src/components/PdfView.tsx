import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes'
import Text from '@/components/ui/Text'
import { colors } from '@/constants/theme'
import { WEB_URL } from '@/lib/config'
import { toAbsoluteUrl } from '@/lib/file'
import { useAuthStore } from '@/store/authStore'

// 웹(pdfjs-dist)과 같은 판. 오래된 웹뷰에서도 돌도록 폴리필이 든 legacy 빌드를 쓴다
const PDFJS_BUILD = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/legacy/build'

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  // 한 번에 다 넘기면 인자 수 제한에 걸려 조각내서 바꾼다
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  }
  return btoa(binary)
}

function buildHtml(base64: string) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4">
<style>html,body{margin:0;padding:0;background:${colors.surfaceAlt}}canvas{display:block;width:100%}</style>
</head>
<body>
<div id="pages"></div>
<script type="module">
const post = (message) => window.ReactNativeWebView.postMessage(JSON.stringify(message));
try {
  const pdfjs = await import('${PDFJS_BUILD}/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '${PDFJS_BUILD}/pdf.worker.min.mjs';
  const data = Uint8Array.from(atob('${base64}'), (c) => c.charCodeAt(0));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const width = document.body.clientWidth;
  // 고해상도 화면에서 글자가 뭉개지지 않도록 기기 픽셀 비율만큼 크게 그린다
  const ratio = window.devicePixelRatio || 1;
  const pages = document.getElementById('pages');
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (width / base.width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    pages.appendChild(canvas);
    await page.render({ canvas, viewport }).promise;
  }
  post({ type: 'done' });
} catch (e) {
  post({ type: 'error', message: String((e && e.message) || e) });
}
</script>
</body>
</html>`
}

interface PdfViewProps {
  /** 서버가 준 계약서 PDF 주소(상대·절대 모두) */
  url: string
  height: number
}

// 계약서 PDF 를 화면 안에 그린다(웹 pay/ContractPreview).
// 안드로이드 웹뷰는 PDF 를 직접 보여주지 못하고, 파일 응답은 인증이 필요해 웹뷰가 받게 하면 토큰을 웹뷰 안에 넣어야 한다.
// 그래서 앱이 토큰으로 받아 그 바이트만 넘기고, 웹뷰 안의 pdf.js 가 캔버스로 그린다. 두 손가락으로 확대해 읽을 수 있다
export default function PdfView({ url, height }: PdfViewProps) {
  const [loaded, setLoaded] = useState<{ url: string; html: string | null } | null>(null)
  const [rendered, setRendered] = useState<{ url: string; ok: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    const token = useAuthStore.getState().accessToken
    fetch(toAbsoluteUrl(url), { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      .then(async (res) => {
        if (!res.ok) throw new Error(`계약서 응답 ${res.status}`)
        return buildHtml(toBase64(await res.arrayBuffer()))
      })
      .then((html) => {
        if (!cancelled) setLoaded({ url, html })
      })
      .catch(() => {
        if (!cancelled) setLoaded({ url, html: null })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const html = loaded?.url === url ? loaded.html : undefined
  const status =
    html === null || (rendered?.url === url && !rendered.ok) ? 'error' : rendered?.url === url && rendered.ok ? 'done' : 'loading'

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string }
      setRendered({ url, ok: message.type === 'done' })
    } catch {
      setRendered({ url, ok: false })
    }
  }

  return (
    <View style={[styles.container, { height }]}>
      {html ? (
        <WebView
          source={{ html, baseUrl: WEB_URL }}
          originWhitelist={['*']}
          onMessage={handleMessage}
          // 결제 화면 스크롤 안에 들어가므로, 계약서 안쪽 스크롤이 바깥 스크롤에 먹히지 않게 한다
          nestedScrollEnabled
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          style={styles.webview}
        />
      ) : null}
      {status !== 'done' ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text size="sm" weight="medium" color={colors.inkHint}>
            {status === 'loading' ? '계약서를 불러오는 중...' : '계약서를 불러올 수 없습니다.'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  webview: { flex: 1, backgroundColor: colors.surfaceAlt },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
})
