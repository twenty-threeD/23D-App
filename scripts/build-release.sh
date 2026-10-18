#!/usr/bin/env bash
# 원스토어 제출용 릴리스 빌드. 사용법: ./scripts/build-release.sh [apk|aab]  (기본 apk)
# 필요: JDK 17, Android SDK(ANDROID_HOME), 프로젝트 루트의 keystore.properties 와 키스토어 파일
set -euo pipefail
cd "$(dirname "$0")/.."

FORMAT="${1:-apk}"
if [ ! -f keystore.properties ]; then
  echo "keystore.properties 가 없습니다. RELEASE.md 의 '서명 키' 항목을 먼저 따라주세요." >&2
  exit 1
fi
# 없어도 빌드는 되지만 푸시 토큰이 안 나와 채팅·전화 알림이 조용히 끊긴다
if [ ! -f google-services.json ]; then
  echo "google-services.json 이 없습니다. RELEASE.md 의 '푸시 알림' 항목을 먼저 따라주세요." >&2
  exit 1
fi

# 네이티브 설정(app.json·플러그인)이 바뀌었을 수 있어 매번 새로 만든다
npx expo prebuild --platform android --clean --no-install

cd android
if [ "$FORMAT" = "aab" ]; then
  ./gradlew bundleRelease
  OUT=app/build/outputs/bundle/release/app-release.aab
else
  ./gradlew assembleRelease
  OUT=app/build/outputs/apk/release/app-release.apk
fi
echo "완료: android/$OUT"
