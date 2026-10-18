# 원스토어 배포 가이드

잇다 앱(`store.idta.app`)을 원스토어에 올리는 순서다. `android/` 는 `npx expo prebuild` 가 만드는 생성물이라
서명·ABI 같은 네이티브 설정은 모두 `app.json` 과 `plugins/` 에 있다.

## 1. 준비물

- JDK 17, Android SDK(`ANDROID_HOME`)
- 프로젝트 루트의 `.env` — `.env.example` 참고. **`EXPO_PUBLIC_TOSS_CLIENT_KEY` 는 운영 키(`live_ck_…`)** 를 넣는다
  (`EXPO_PUBLIC_*` 값은 빌드할 때 앱에 그대로 들어간다. 토스 클라이언트 키처럼 공개용 값만 넣는다)
- 서명 키스토어(아래)
- 프로젝트 루트의 `google-services.json` — 안드로이드 푸시(FCM)용 Firebase 설정. 저장소가 공개라 커밋하지 않는다(아래 '푸시 알림')

## 2. 서명 키

한 번 만든 키는 **앱의 신분증**이다. 잃어버리면 같은 앱으로 업데이트를 올릴 수 없으니 팀 비밀 저장소에 따로 보관한다.
키스토어 파일과 `keystore.properties` 는 `.gitignore` 에 들어 있어 커밋되지 않는다.

```bash
# 저장소 밖(예: ~/itda-keys)에 만든다
keytool -genkeypair -v -keystore ~/itda-keys/itda-release.keystore \
  -alias itda -keyalg RSA -keysize 2048 -validity 10000
```

프로젝트 루트에 `keystore.properties` 를 만든다(상대 경로면 프로젝트 루트 기준, 절대 경로도 된다).

```properties
storeFile=/Users/<me>/itda-keys/itda-release.keystore
storePassword=…
keyAlias=itda
keyPassword=…
```

`keystore.properties` 가 없으면 릴리스 빌드도 디버그 키로 서명된다(로컬 확인용). 스크립트는 제출용 빌드를 막기 위해 파일이 없으면 멈춘다.

## 3. 버전 올리기

`app.json` 에서 올린다. 원스토어는 같은 `versionCode` 를 다시 받지 않는다.

- `expo.version` — 사용자에게 보이는 버전(예: `1.0.1`)
- `expo.android.versionCode` — 올릴 때마다 1씩 증가하는 정수

## 4. 빌드

```bash
./scripts/build-release.sh        # APK  → android/app/build/outputs/apk/release/app-release.apk
./scripts/build-release.sh aab    # AAB  → android/app/build/outputs/bundle/release/app-release.aab
```

배포 빌드에는 휴대폰용 ARM(`armeabi-v7a`, `arm64-v8a`)만 넣는다(`expo-build-properties`).
통화(아고라) 네이티브 라이브러리가 커서, 에뮬레이터용 x86 까지 넣으면 용량이 크게 늘어난다.

서명 확인:

```bash
$ANDROID_HOME/build-tools/<버전>/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

## 5. 원스토어 개발자센터 등록

- 앱 아이콘(512×512): `assets/store-icon-512.png`
- 개인정보처리방침 URL: https://www.idta.store/privateinfo (앱 안에서도 메인 하단·회원가입 약관에서 열린다)
- 이용약관: 앱 `/eula`, 웹 https://www.idta.store/eula
- 문의 이메일: itda23d@gmail.com
- 권한 설명(심사 문의 대비)
  - 마이크·카메라: 음성·영상 통화
  - 사진: 프로필·서비스 이미지, 채팅 첨부
  - 블루투스 연결: 통화 소리를 블루투스 이어폰으로 보내기
- 결제: 토스페이먼츠(카드) — 실물이 아닌 용역 중개라 원스토어 인앱결제 대상이 아니다. 심사 메모에 함께 적는다
- 테스트 계정: 심사용 계정(로그인·채팅·결제 화면 확인용)을 심사 메모에 적는다

## 6. 알아둘 것

- 통화 중 앱을 벗어나면 안드로이드가 마이크를 막을 수 있다(포그라운드 서비스 미적용).
- iOS 푸시는 유료 Apple Developer 계정(APNs)이 있어야 해서 아직 안 된다. 안드로이드만 동작한다.

## 푸시 알림

서버가 Expo 푸시(`ExponentPushToken[…]`)로 채팅·전화 알림을 보내고, Expo 가 안드로이드에서는 FCM 으로 넘긴다.

- Expo 프로젝트: `@16bit_16/itda`(`app.json` 의 `extra.eas.projectId`). 이게 있어야 푸시 토큰이 나온다
- Firebase 프로젝트: `itda-5c387`(안드로이드 앱 `store.idta.app` 등록)
- `google-services.json`: Firebase 콘솔 → 프로젝트 설정 → 내 앱에서 받는다. 프로젝트 루트에 두면 prebuild 가 넣는다.
  없으면 토큰 발급이 실패해 푸시가 오지 않는다(빌드 스크립트가 막는다)
- FCM V1 서비스 계정 키: 서버(Expo)가 FCM 으로 보낼 때 쓰는 비밀키. `eas credentials -p android` →
  Google Service Account → Push Notifications (FCM V1) 로 Expo 에 올려 두었다. 키를 새로 만들면 다시 올린다
- 키·설정 파일 원본은 `~/itda-keys` 에 서명 키와 함께 둔다
- 소셜 로그인은 카카오·네이버만 지원한다(구글은 웹뷰 로그인을 막는다).

## iOS (준비 상태)

- 설정은 넣어 두었다: 번들 ID `store.idta.app`, 사진·카메라·마이크 사용 문구(한국어), 통화가 이어지도록 백그라운드 오디오(`UIBackgroundModes: audio`)
- **빌드하려면 Xcode 26.4 이상이 필요하다**(Expo SDK 57 요구 사항). 26.0 에서는 `expo-modules-jsi` 의 Swift 6.2 문법(`weak let`)에서 막힌다
- 시뮬레이터 실행: `npx expo run:ios --device "iPhone 17"`
- 실기기·앱스토어: Apple Developer 팀 가입 후 Xcode 에서 서명 팀 지정, `ios/` 는 생성물이라 서명은 EAS Build 나 config plugin 으로 넣는다
- 통화 화면공유(보내기)는 방송 확장(ReplayKit Broadcast Upload Extension)으로 한다. 확장은 `targets/ScreenShare` 에 있고
  `@bacons/apple-targets` 가 prebuild 때 Xcode 타깃(`store.idta.app.ScreenShare`)으로 만든다. 확장에는 아고라 `AgoraRtcEngine_iOS/ReplayKit` 만 들어간다(`targets/ScreenShare/pods.rb`)
  - 실기기에서만 된다(시뮬레이터는 ReplayKit 방송을 못 한다). 서명할 때 확장 타깃에도 같은 팀을 지정한다(`ios.appleTeamId`)
- 소리 출력: 안드로이드는 수화부·스피커·이어폰·블루투스를 고를 수 있고, iOS 는 스피커 켜고 끄기만 된다(아고라 API 차이)
