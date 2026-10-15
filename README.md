# 23D-App

> **사람과 사람을 잇다.**
> 블록체인 기반 용역 중개 플랫폼 **잇다(ITDA)** 의 Android 앱입니다.

웹([23D-Web](https://github.com/twenty-threeD/23D-Web))을 React Native(Expo)로 옮긴 앱이며, **원스토어 배포**를 목표로 합니다.
랜딩 페이지는 앱에 두지 않고, 실행하면 바로 메인 화면이 열립니다.

## 🛠 Tech Stack

![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)

- **Expo Router** — 파일 기반 라우팅 (`src/app`)
- **Zustand** — 전역 상태
- **expo-image / expo-font** — 이미지 캐시, Pretendard 폰트 내장

## 📁 Project Structure

```text
23D-App/
├── assets/            # 아이콘·스플래시·폰트·이미지·사운드
├── src/
│   ├── app/           # 화면 (Expo Router)
│   ├── components/    # 재사용 UI (ui/ 는 공용 기본 컴포넌트)
│   ├── constants/     # 디자인 토큰 (theme.ts)
│   ├── hooks/         # 커스텀 훅
│   ├── lib/           # API·유틸
│   └── store/         # Zustand 스토어
├── app.json           # 앱 설정 (패키지명·아이콘·플러그인)
└── package.json
```

## 🚀 Getting Started

### 1. 설치

```bash
git clone https://github.com/twenty-threeD/23D-App.git
cd 23D-App
npm install
```

### 2. 환경 변수

`.env.example` 을 복사해 `.env` 를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

### 3. 실행 (개발 빌드)

통화(Agora)·결제(WebView) 같은 네이티브 모듈을 쓰므로 Expo Go 대신 **개발 빌드**로 실행합니다.
Android Studio(SDK)와 JDK 17 이상이 필요합니다.

```bash
npx expo run:android   # 개발 빌드를 만들어 에뮬레이터·기기에 설치하고 실행
```

한 번 설치한 뒤에는 `npx expo start` 로 개발 서버만 띄우면 됩니다.

## 🧹 Check

```bash
npm run typecheck
npm run lint
```

## 👥 Team

**23D** — Repository maintained by **twenty-threeD**.
