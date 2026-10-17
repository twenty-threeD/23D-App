import { useState } from 'react'
import { Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import OptionSheet, { type SheetOption } from '@/components/ui/OptionSheet'
import { colors } from '@/constants/theme'
import type { AudioOutput } from '@/lib/agoraEngine'
import { useCallStore } from '@/store/callStore'
import CallButton from './CallButton'

const OUTPUT_LABEL: Record<AudioOutput, string> = {
  earpiece: '수화부',
  speaker: '스피커',
  headset: '이어폰',
  bluetooth: '블루투스',
}

const OUTPUT_ICON: Record<AudioOutput, keyof typeof MaterialIcons.glyphMap> = {
  earpiece: 'phone-in-talk',
  speaker: 'volume-up',
  headset: 'headset',
  bluetooth: 'bluetooth-audio',
}

// 통화 소리가 나올 곳. 웹 브라우저와 달리 휴대폰은 수화부·스피커를 고를 수 있고, 이어폰·블루투스가 붙으면 SDK 가 그쪽으로 돌린다.
// 따로 붙은 기기가 없으면 눌러서 수화부↔스피커를 바로 바꾸고, 있으면 목록에서 고르게 한다(휴대폰 전화 앱과 같은 방식)
export default function AudioOutputButton({ size }: { size?: 'sm' }) {
  const audioOutput = useCallStore((s) => s.audioOutput)
  const externalOutput = useCallStore((s) => s.externalOutput)
  const selectAudioOutput = useCallStore((s) => s.selectAudioOutput)
  const [open, setOpen] = useState(false)

  // iOS 는 스피커를 끄면 시스템이 연결된 기기로 돌려줘서, 이어폰이 붙어 있는 동안 수화부를 따로 고를 수 없다
  const choices: AudioOutput[] = [
    ...(externalOutput ? [externalOutput] : []),
    ...(Platform.OS === 'android' || !externalOutput ? (['earpiece'] as const) : []),
    'speaker',
  ]
  const options: SheetOption<AudioOutput>[] = choices.map((value) => ({
    value,
    label: OUTPUT_LABEL[value],
    icon: <MaterialIcons name={OUTPUT_ICON[value]} size={22} color={value === audioOutput ? colors.main : colors.inkSub} />,
  }))

  return (
    <>
      <CallButton
        icon={OUTPUT_ICON[audioOutput]}
        label={OUTPUT_LABEL[audioOutput]}
        tone={audioOutput === 'earpiece' ? 'normal' : 'on'}
        size={size}
        showLabel={size !== 'sm'}
        onPress={() => {
          if (externalOutput) setOpen(true)
          else selectAudioOutput(audioOutput === 'speaker' ? 'earpiece' : 'speaker')
        }}
      />
      <OptionSheet visible={open} options={options} value={audioOutput} onSelect={selectAudioOutput} onClose={() => setOpen(false)} title="소리 출력" />
    </>
  )
}
