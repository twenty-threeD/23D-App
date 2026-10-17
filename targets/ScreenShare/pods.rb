# 확장에 아고라 엔진 pod 를 넣는다(아고라 공식 문서의 화면공유 확장 설정과 같다).
# ReplayKit 서브스펙만 넣으면 앱 본체의 전체 pod 와 서로 다른 pod 타깃이 돼 같은 프레임워크를 두 번 복사하다 빌드가 깨진다.
# 버전은 앱 본체가 쓰는 엔진(react-native-agora 의 podspec)과 반드시 같아야 해서 그 파일에서 읽어 온다
agora_podspec = File.join(File.dirname(`node --print "require.resolve('react-native-agora/package.json')"`.strip), 'react-native-agora.podspec')
agora_version = File.read(agora_podspec)[/'AgoraRtcEngine_iOS',\s*'([^']+)'/, 1]
pod 'AgoraRtcEngine_iOS', agora_version
