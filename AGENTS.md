# 잇다(ITDA) 앱 프로젝트 규칙

모든 폰트는 Pretendard로 통일하십시오.
모든 추론 과정은 영어로 하되, 사용자에 대한 답변은 한글로 하십시오.

이 앱은 웹([23D-Web](https://github.com/twenty-threeD/23D-Web))을 Expo(React Native)로 옮긴 것이다.
화면·문구·동작은 웹을 기준으로 하고, 웹과 달라지는 부분은 이유를 주석으로 남긴다.

## 반드시 지킬 것

### 0. Expo API 는 기억이 아니라 문서로 확인한다
Expo 는 SDK 마다 API 가 바뀐다. 이 프로젝트는 **SDK 57** 이다.

- 문서: `https://docs.expo.dev/versions/v57.0.0/` (주소 뒤에 `.md` 를 붙이면 마크다운으로 받을 수 있다)
- 전체 목차: https://docs.expo.dev/llms.txt
- 패키지는 `npx expo install <패키지>` 로만 설치한다 (SDK 에 맞는 버전을 골라준다)
- `android/`·`ios/` 는 `npx expo prebuild` 가 만드는 생성물이라 커밋하지 않고 직접 고치지 않는다.
  네이티브 설정은 `app.json` 과 config plugin 으로 한다

### 1. 마진 사용 금지
`margin`, `marginTop`, `marginHorizontal` … 을 쓰지 않는다.
간격은 **부모의 `gap`(`rowGap`·`columnGap`)** 으로 만든다. 필요하면 `padding` 을 쓴다.

```tsx
// ✗
<View><Text style={{ marginBottom: 16 }}>제목</Text><Text>내용</Text></View>

// ✓
<View style={{ gap: 16 }}><Text>제목</Text><Text>내용</Text></View>
```

마진은 형제끼리 겹치거나 조건부 렌더로 빠질 때 간격이 조용히 달라진다.
`gap` 은 부모 한 곳에서 간격을 관리하므로 그런 일이 없다.

### 2. 기존 디자인 스타일을 따를 것
새 색·모양을 임의로 만들지 말고, 이미 쓰는 것을 먼저 찾는다.

- 색·글자 크기·라운드는 `src/constants/theme.ts` 의 토큰을 쓴다
  (`colors.main` = `#FE6A4C` 브랜드 오렌지, `colors.contract` = 계약서 본문색, `colors.ink*` 본문 텍스트)
- 글자는 RN `Text` 대신 **`@/components/ui/Text`** 로 그린다. 그래야 Pretendard 가 붙는다
- 버튼·입력칸·모달·선택 목록은 `src/components/ui` 의 공용 컴포넌트를 먼저 쓴다
- 웹에 같은 화면이 있으면 그 화면의 라운드·보더·타이포를 그대로 따른다
- 임의값(`'#xxxxxx'`)은 시안에 있는 색을 옮길 때만 쓰고, 반복되면 토큰으로 올린다

### 3. 화면 export 형식
`src/app/**` 의 화면 파일 기본 export 는 항상 이 형식이다.

```tsx
export default function Page() { ... }
```

레이아웃(`_layout.tsx`)은 `export default function Layout()` 으로 쓴다.

## 알아둘 것

### 갑 / 을
계정 속성이 아니라 **채팅방마다 정해지는 관계**다. `authStore.role` 로 판단하면 안 된다.

- **을** = post(서비스)를 올린 사람. 용역을 제공하고 **대금을 받는** 쪽
- **갑** = 그 post에 문의를 건 사람. **대금을 지급하는** 쪽

즉 `post.member` 는 항상 을이다. 판단 기준은 `post.member.username === myUsername` 하나뿐이다.

### 백엔드 파일 URL
서버가 주는 파일·이미지 URL 은 **반드시 `toAbsoluteUrl()`(`src/lib/file.ts`)을 거쳐** 쓴다.
서버는 `/files/…` 상대 경로와 절대 URL 을 섞어 주는데, 앱에는 웹처럼 같은 오리진 프록시가 없어 상대 경로로는 이미지가 뜨지 않는다.

### 인증
웹은 리프레시 토큰을 httpOnly 쿠키로 다뤘지만, 앱은 로그인 응답 본문의 `refreshToken` 을 SecureStore 에 두고
`/api/token/reissue` 에 본문으로 보내 재발급한다. 채팅·통화 STOMP 는 CONNECT 헤더의 `Authorization` 으로 인증한다.

### API 스펙은 라이브를 확인
스펙이 자주 바뀐다. 기억이나 기존 코드에 의존하지 말고 작업 전에 확인한다.

```
curl https://api.idta.store/v3/api-docs
```

### 채팅 특수 메시지
백엔드에 구조화된 시스템 메시지 타입이 없어, **대괄호 접두사 + JSON** 규약을 쓴다.
`[채팅 시작]`, `[계약서 제안]`, `[계약서 체결 완료]`, `[결제 완료]` — 본문 대신 카드로 렌더한다. 웹과 같은 규약이어야 웹·앱 사용자가 같은 방에서 대화할 수 있다.

### 주석
한글로 쓰고, **무엇을 하는지가 아니라 왜 그렇게 했는지**를 남긴다.
특히 우회·예외 처리는 배경을 적어야 나중에 걷어낼 수 있다.

## 명령어

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo start      # 개발 서버 (개발 빌드가 설치된 기기·에뮬레이터에서 연다)
npx expo run:android  # 개발 빌드 생성·설치
```

작업을 마쳤다고 말하기 전에 타입체크와 린트를 통과시킨다.
