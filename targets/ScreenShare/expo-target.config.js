// 통화 화면공유용 iOS 방송 업로드 확장. iOS 는 앱이 직접 다른 앱 화면까지 찍을 수 없어
// 시스템 '화면 기록'이 이 확장을 돌리고, 확장 안의 아고라 AgoraReplayKitHandler 가 찍은 화면을 앱으로 넘긴다.
// ios/ 는 prebuild 생성물이라 @bacons/apple-targets 가 prebuild 때 이 폴더로 확장 타깃을 만들어 붙인다
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'broadcast-upload',
  name: 'ScreenShare',
  displayName: '잇다 화면 공유',
  bundleIdentifier: '.ScreenShare',
  // 앱 본체와 같은 최소 버전(Expo SDK 57 이 앱 타깃에 넣는 값)
  deploymentTarget: '16.4',
  frameworks: ['ReplayKit'],
}
