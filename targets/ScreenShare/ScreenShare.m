// 실제 처리는 Info.plist 의 AgoraReplayKitHandler(아고라 프레임워크)가 한다.
// 확장 타깃은 컴파일할 소스가 하나도 없으면 실행 파일이 만들어지지 않아 설치에 실패하므로, 빈 소스 하나를 둔다
// (아고라 공식 예제도 쓰지 않는 SampleHandler 를 같은 이유로 남겨 둔다)
#import <Foundation/Foundation.h>
