// 원스토어 배포용 릴리스 서명. android/ 는 prebuild 가 만드는 생성물이라 직접 고치지 않고,
// prebuild 때 app/build.gradle 에 release 서명 설정을 넣는다.
// 키스토어 경로·비밀번호는 저장소에 올리지 않는 keystore.properties(프로젝트 루트)에서 읽는다.
// 파일이 없으면 지금처럼 디버그 키로 서명돼 로컬 확인용 릴리스 빌드는 그대로 된다
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// itda-release-signing'

const SIGNING_BLOCK = `
    ${MARKER}
    def itdaKeystorePropsFile = rootProject.file("../keystore.properties")
    def itdaKeystoreProps = new Properties()
    if (itdaKeystorePropsFile.exists()) {
        itdaKeystorePropsFile.withInputStream { itdaKeystoreProps.load(it) }
    }
`

const RELEASE_CONFIG = `
        release {
            if (itdaKeystorePropsFile.exists()) {
                // 키스토어는 저장소 밖에 두는 걸 권해 절대 경로도 받는다. 상대 경로면 프로젝트 루트 기준이다
                def itdaStorePath = itdaKeystoreProps['storeFile']
                storeFile new File(itdaStorePath).isAbsolute() ? new File(itdaStorePath) : rootProject.file("../" + itdaStorePath)
                storePassword itdaKeystoreProps['storePassword']
                keyAlias itdaKeystoreProps['keyAlias']
                keyPassword itdaKeystoreProps['keyPassword']
            }
        }`

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents
    if (gradle.includes(MARKER)) return cfg

    // android { 바로 안쪽에 속성 읽기를 넣는다
    gradle = gradle.replace(/android\s*\{/, (m) => `${m}${SIGNING_BLOCK}`)
    // signingConfigs { debug {...} } 뒤에 release 를 더한다
    gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`)
    // release 빌드 타입이 debug 서명 대신 release 서명을 쓰게 한다(키가 없으면 debug 로 남긴다)
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
      '$1signingConfig itdaKeystorePropsFile.exists() ? signingConfigs.release : signingConfigs.debug',
    )
    cfg.modResults.contents = gradle
    return cfg
  })
}
