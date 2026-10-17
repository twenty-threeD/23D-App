# 확장에는 아고라 화면 전달 프레임워크만 넣는다. 방송 확장은 메모리가 50MB 로 제한돼 엔진 전체를 넣으면 안 된다.
# 버전은 앱 본체가 쓰는 엔진(react-native-agora 의 podspec)과 반드시 같아야 해서 그 파일에서 읽어 온다
agora_podspec = File.join(File.dirname(`node --print "require.resolve('react-native-agora/package.json')"`.strip), 'react-native-agora.podspec')
agora_version = File.read(agora_podspec)[/'AgoraRtcEngine_iOS',\s*'([^']+)'/, 1]
pod 'AgoraRtcEngine_iOS/ReplayKit', agora_version
