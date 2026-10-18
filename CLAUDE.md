@AGENTS.md

# 작업 현황 (이어서 작업할 때 먼저 읽기)

웹(`../23D-Web`, Next.js)을 이 Expo 앱으로 옮기는 중이다. 목표는 **원스토어 배포**. 랜딩 페이지는 옮기지 않는다(앱은 메인에서 시작).

## 브랜치·PR 규칙

- 기능마다 이슈 → 브랜치 `{이슈번호}-feat-{이름}` → `release` 로 PR. 브랜치는 직전 기능 브랜치 위에 쌓는다(stacked)
- 다 모이면 `release` → `main` 을 한 번에 머지한다
- 커밋: `feat :: 한글 요약`, 이슈 제목: `[Feat] English title`, PR 본문: 작업내용 / 관련 이슈(close #N) / Jira(선택) / 확인사항
- PR 머지는 사람이 한다(자동 머지 권한 없음)

## 끝낸 기능 (PR → release)

| PR | 내용 |
| --- | --- |
| #2 | 프로젝트 설정(Expo SDK 57, 라우터, 디자인 토큰, Pretendard) |
| #4 | API 레이어·로그인 세션(SecureStore, 토큰 재발급) |
| #8 | 하단 탭·헤더, 메인·능력자 찾기·더보기 |
| #9 | 서비스 상세(리뷰·AI 요약·찜·문의) |
| #10 | 로그인·회원가입·비밀번호 재설정·소셜 로그인(카카오·네이버) |
| #12 | 채팅(STOMP 실시간, SQLite 캐시) |
| #14 | 커뮤니티 |
| #16 | 블록체인 검증 |
| #18 | 프로필·계정 설정·내 게시글·찜 |
| #20 | 서비스 등록·수정 |
| #22 | 약관·개인정보처리방침·FAQ·문서·소개·팀, 메인 푸터 |
| #24 | 계약서 확인·토스페이먼츠 결제(웹뷰 결제창) |
| #27 | 계약서 작성·서명·PDF 생성·체결 |
| #28 | 앱 알림(SSE, 알림 벨·화면) |
| #30 | 음성·영상 통화(react-native-agora) |
| #32 | 원스토어 릴리스 빌드 설정(`RELEASE.md`) |

위까지 `main` 에 머지됨(#33). 이후 작업도 `release` 로 PR 한다(`release` 는 `main` 에서 다시 만들었다).

| PR | 내용 |
| --- | --- |
| #35 | iOS 설정(권한 문구·백그라운드 오디오) — Xcode 26.4 필요 |
| #37 | 통화 화면공유(안드로이드) |
| #40 | 두 기기 테스트에서 찾은 버그(채팅 자동 스크롤·빈 결제 말풍선·딥링크 프로필 사진·검색 문구) |
| #41 | iOS 화면공유(방송 확장 `targets/ScreenShare`), 통화 소리 출력 선택(수화부·스피커·이어폰·블루투스) |

## 남은 일

- 원스토어 제출: 운영 키스토어 만들기, `.env` 에 토스 운영 키, 스토어 등록 정보(`RELEASE.md`)
- 테스트 계정 두 기기 확인 완료: 채팅 실시간·알림·통화·화면공유·결제 완료 카드·계약서 보기. 남은 것: 계약서 제안→서명 제출, 서비스 등록·수정, 커뮤니티 댓글
- 배포는 안드로이드 원스토어만(iOS 미배포). 원스토어 등록 단계에서는 사용자에게 로그인을 먼저 요청한다
- 통화 중 백그라운드 마이크 유지(포그라운드 서비스)
- iOS 푸시: 유료 Apple Developer 계정(APNs) 필요
- 릴리스 APK 가 약 210MB — 아고라 확장 모듈 제외·AAB 배포로 줄이기 검토
- iOS: Xcode 27.1 에서 시뮬레이터 빌드·실행 확인함. 화면공유는 실기기에서만 확인 가능
- 마지막에 `release` → `main` 머지

## 실행·빌드

```bash
npx expo start --port 8081                      # 개발 서버
adb reverse tcp:8081 tcp:8081                   # 에뮬레이터 연결
# 네이티브 모듈을 추가했으면 개발 빌드를 다시 만든다
export JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home ANDROID_HOME=~/Library/Android/sdk
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/debug/app-debug.apk
./scripts/build-release.sh [apk|aab]             # 릴리스(keystore.properties 필요)
```

딥링크로 화면 바로 열기: `adb shell am start -a android.intent.action.VIEW -d "itda://item/78" store.idta.app`

## 알아둘 함정

- `../23D-Web` 의 일부 파일(.env 등)은 iCloud 에서 내려받지 않은 상태라 `cp`·재귀 `grep` 이 멈출 수 있다. 파일을 하나씩 읽는다
- 웹 `.env` 의 토스 키는 옮기지 않았다. 로컬 `.env` 에는 API·체인 주소만 있다
- 에뮬레이터 DNS 가 안 되면 `-dns-server 8.8.8.8,1.1.1.1` 로 띄운다
- 시스템 UI ANR 창이 뜨면 `adb shell settings put global hide_error_dialogs 1`
- **iOS 빌드는 iCloud 폴더(`~/Documents`) 밖에서 한다.** 빌드 중 node_modules 안에 생기는 프레임워크에 iCloud 속성(FinderInfo)이 붙어 코드 서명이 `resource fork, Finder information … not allowed` 로 실패한다. `rsync -a --exclude /ios --exclude /android --exclude /.git ./ ~/itda-ios-build/` 로 복사해 거기서 `npx expo run:ios`
- iCloud 가 안 내려받은 파일(dataless)이 node_modules 에 생기면 pod install 이 `Blocking operation timed out` 으로 멈춘다. `find node_modules -flags +dataless` 로 찾아 npm 패키지에서 다시 꺼내 넣는다
- 서버는 계정당 리프레시 토큰을 하나만 둔다. 같은 계정으로 다른 곳(웹·curl)에서 로그인하면 앱 세션이 끊긴다
- 푸시는 `google-services.json`(Firebase, 커밋 안 함)이 프로젝트 루트에 있어야 온다. 원본은 `~/itda-keys`. 자세한 건 `RELEASE.md` '푸시 알림'
- 스냅샷으로 띄운 에뮬레이터는 FCM 연결이 죽어 있어 푸시가 안 올 수 있다. `adb shell svc wifi disable && adb shell svc wifi enable` 로 다시 붙인다
- adb `input text` 는 Gboard 가 한국어 모드면 글자가 깨진다. 테스트 중에는 `pm disable-user --user 0 com.google.android.inputmethod.latin` 로 끄고 끝나면 `pm enable` 으로 되돌린다
