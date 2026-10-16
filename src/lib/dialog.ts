import { Alert } from 'react-native'

// 웹의 window.confirm / alert 를 대신한다. 시스템 대화상자라 화면 어디서든 같은 모양으로 뜬다
export function confirm(message: string, options: { title?: string; confirmText?: string; destructive?: boolean } = {}) {
  const { title = '확인', confirmText = '확인', destructive = false } = options
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      // 바깥을 눌러 닫아도 '취소'로 본다
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
}

export function alert(message: string, title = '알림') {
  return new Promise<void>((resolve) => {
    Alert.alert(title, message, [{ text: '확인', onPress: () => resolve() }], { onDismiss: () => resolve() })
  })
}
