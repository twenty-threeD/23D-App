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

## 남은 일

- 원스토어 제출: 운영 키스토어 만들기, `.env` 에 토스 운영 키, 스토어 등록 정보(`RELEASE.md`)
- 테스트 계정으로 로그인이 필요한 흐름 실제 확인(채팅·계약·결제 승인·통화·알림)
- 통화 중 백그라운드 마이크 유지(포그라운드 서비스), 앱이 꺼져 있을 때 푸시(서버 연동 필요)
- 릴리스 APK 가 약 210MB — 아고라 확장 모듈 제외·AAB 배포로 줄이기 검토
- iOS: 설정은 끝났고 **Xcode 26.4 이상으로 올린 뒤** `npx expo run:ios` 로 확인(지금 맥은 26.0.1 이라 빌드가 막힌다)
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
