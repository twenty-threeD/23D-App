import { Linking } from 'react-native'

interface IntentUrl {
  /** 앱을 바로 여는 주소(scheme://…). 만들 수 없으면 null */
  appUrl: string | null
  packageName: string | null
  /** 앱이 없을 때 대신 열 웹 주소(S.browser_fallback_url) */
  fallbackUrl: string | null
}

/**
 * 안드로이드 intent 주소를 앱 스킴 주소로 바꾼다.
 * 카드사·은행 결제 페이지는 `intent://…#Intent;scheme=X;package=Y;end` 또는 `intent:X://…#Intent;…;end` 로 앱을 부른다.
 * 크롬은 이 주소를 스스로 풀지만 웹뷰는 못 열어(net::ERR_UNKNOWN_URL_SCHEME) 토스페이먼츠 웹뷰 가이드대로 앱 스킴으로 바꿔 연다
 */
export function parseIntentUrl(url: string): IntentUrl | null {
  if (!url.startsWith('intent:')) return null
  const hashIndex = url.indexOf('#Intent;')
  const body = url.slice('intent:'.length, hashIndex < 0 ? undefined : hashIndex)
  const extras = hashIndex < 0 ? [] : url.slice(hashIndex + '#Intent;'.length).split(';')
  const pick = (key: string) => extras.find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1) ?? null
  const scheme = pick('scheme')
  const fallback = pick('S.browser_fallback_url')
  return {
    // 'intent://host…' 는 scheme 값을 붙이고, 'intent:ispmobile://…' 처럼 본문에 스킴이 있으면 그대로 쓴다
    appUrl: body.startsWith('//') ? (scheme ? `${scheme}:${body}` : null) : body || null,
    packageName: pick('package'),
    fallbackUrl: fallback ? decodeURIComponent(fallback) : null,
  }
}

/**
 * 웹뷰가 부른 외부 앱 주소(카드사 앱·간편결제 앱 등)를 연다.
 * 앱이 없으면 스토어의 설치 화면을 열고, 그것도 안 되면 웹뷰가 대신 열 주소를 돌려준다.
 * canOpenURL 로 먼저 묻지 않는다 — 안드로이드 11 부터는 <queries> 에 등록하지 않은 앱을 '없음'으로 답해서,
 * 설치돼 있어도 스토어로 보내게 된다. openURL 은 등록과 상관없이 열린다
 */
export async function openAppUrl(url: string): Promise<{ opened: boolean; fallbackUrl: string | null }> {
  const intent = parseIntentUrl(url)
  if (!intent) {
    const opened = await Linking.openURL(url).then(
      () => true,
      () => false,
    )
    return { opened, fallbackUrl: null }
  }
  if (intent.appUrl) {
    const opened = await Linking.openURL(intent.appUrl).then(
      () => true,
      () => false,
    )
    if (opened) return { opened, fallbackUrl: null }
  }
  if (intent.packageName) {
    const opened = await Linking.openURL(`market://details?id=${intent.packageName}`).then(
      () => true,
      () => false,
    )
    if (opened) return { opened, fallbackUrl: null }
  }
  return { opened: false, fallbackUrl: intent.fallbackUrl }
}
