import { useRef } from 'react'
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { ShouldStartLoadRequest, WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes'
import BackHeader from '@/components/BackHeader'
import { toast, ToastHost } from '@/components/ui/Toast'
import { colors } from '@/constants/theme'
import { WEB_URL } from '@/lib/config'
import { openAppUrl } from '@/lib/appLink'
import { confirm } from '@/lib/dialog'

// 결제창이 끝나면 토스가 이 주소로 보낸다. 웹뷰가 실제로 열기 전에 가로채서 결과만 읽는다
// (웹의 /pay/success·/pay/fail 과 같은 경로라, 가로채지 못해도 웹이 안전하게 처리한다)
const SUCCESS_URL = `${WEB_URL}/pay/success`
const FAIL_URL = `${WEB_URL}/pay/fail`

export interface TossCheckoutRequest {
  clientKey: string
  orderId: string
  orderName: string
  amount: number
  customerName: string
}

export interface TossCheckoutSuccess {
  paymentKey: string
  orderId: string
  amount: number
}

export interface TossCheckoutFailure {
  code: string | null
  message: string | null
}

// 스크립트 안에 문자열로 넣을 값. 주문명은 사용자가 쓴 글 제목이라 '</script>' 가 들어가도 태그가 닫히지 않게 '<' 를 이스케이프한다
function js(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function buildHtml(request: TossCheckoutRequest) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://js.tosspayments.com/v2/standard"></script>
</head>
<body>
<script>
(async function () {
  try {
    var tossPayments = TossPayments(${js(request.clientKey)});
    var payment = tossPayments.payment({ customerKey: 'ANONYMOUS' });
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: ${js(request.amount)} },
      orderId: ${js(request.orderId)},
      orderName: ${js(request.orderName)},
      successUrl: ${js(SUCCESS_URL)},
      failUrl: ${js(FAIL_URL)},
      customerName: ${js(request.customerName)}
    });
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ code: (e && e.code) || null, message: (e && e.message) || null }));
  }
})();
</script>
</body>
</html>`
}

interface TossCheckoutModalProps {
  request: TossCheckoutRequest
  onSuccess: (result: TossCheckoutSuccess) => void
  onFail: (failure: TossCheckoutFailure) => void
  /** 사용자가 결제창을 닫았을 때 */
  onClose: () => void
}

// 웹의 OnClickPay(토스페이먼츠 v2 결제창). 앱용 SDK 대신 같은 결제창 스크립트를 웹뷰에서 띄운다 —
// 웹과 같은 연동 키(API 개별 연동)를 그대로 쓰고, 서버의 사전 등록(prepare)·승인(confirm) 흐름도 바뀌지 않는다
export default function TossCheckoutModal({ request, onSuccess, onFail, onClose }: TossCheckoutModalProps) {
  const webViewRef = useRef<WebView>(null)
  // 돌아오는 주소는 리다이렉트 과정에서 두 번 걸릴 수 있다. 승인은 한 번만 보내야 해서 처음 것만 처리한다
  const finishedRef = useRef(false)

  function finish(run: () => void) {
    if (finishedRef.current) return
    finishedRef.current = true
    run()
  }

  function handleShouldStart(event: ShouldStartLoadRequest) {
    const { url } = event
    if (url.startsWith(SUCCESS_URL)) {
      const query = new URL(url).searchParams
      const paymentKey = query.get('paymentKey')
      const orderId = query.get('orderId')
      const amount = Number(query.get('amount'))
      finish(() =>
        paymentKey && orderId && Number.isFinite(amount)
          ? onSuccess({ paymentKey, orderId, amount })
          : onFail({ code: null, message: '결제 정보를 확인할 수 없습니다.' }),
      )
      return false
    }
    if (url.startsWith(FAIL_URL)) {
      const query = new URL(url).searchParams
      finish(() => onFail({ code: query.get('code'), message: query.get('message') }))
      return false
    }
    if (/^(https?|about|data|blob|javascript):/i.test(url)) return true

    // 카드사·간편결제 앱 호출. 웹뷰가 열지 못하는 주소라 앱이 대신 연다
    void openAppUrl(url).then(({ opened, fallbackUrl }) => {
      if (opened) return
      if (fallbackUrl) webViewRef.current?.injectJavaScript(`location.href = ${js(fallbackUrl)}; true;`)
      else toast.error('결제 앱을 열 수 없어요. 앱이 설치되어 있는지 확인해주세요.')
    })
    return false
  }

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const failure = JSON.parse(event.nativeEvent.data) as TossCheckoutFailure
      finish(() => onFail(failure))
    } catch {
      finish(() => onFail({ code: null, message: null }))
    }
  }

  async function requestClose() {
    if (await confirm('결제를 취소할까요?', { confirmText: '결제 취소', destructive: true })) finish(onClose)
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => void requestClose()}>
      <View style={styles.container}>
        <BackHeader title="결제" onBack={() => void requestClose()} />
        <WebView
          ref={webViewRef}
          source={{ html: buildHtml(request), baseUrl: WEB_URL }}
          // 기본 허용 목록은 http(s) 밖의 주소를 canOpenURL 로 물어보고 열어서, 등록하지 않은 카드사 앱은 '없음'이 된다.
          // 모든 주소를 받아 직접 판단한다
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={handleShouldStart}
          onMessage={handleMessage}
          // 카드사 인증 창이 새 창(window.open)으로 뜨면 같은 웹뷰 안에서 열어야 결제가 이어진다
          setSupportMultipleWindows={false}
          // 일부 카드사 인증 페이지가 http 자원을 섞어 쓴다(토스페이먼츠 웹뷰 가이드)
          mixedContentMode="compatibility"
          thirdPartyCookiesEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.main} />
            </View>
          )}
          style={styles.webview}
        />
      </View>
      {/* 모달은 별도 창이라 루트의 토스트가 가려진다. 여기서 일어난 오류·안내는 모달 위에 띄운다 */}
      <ToastHost />
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  webview: { flex: 1 },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
})
