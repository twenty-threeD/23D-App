import { Vibration } from 'react-native'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'

// 통화 소리(웹 lib/ringtone.ts). 벨소리는 받거나 끊을 때까지 반복하고, 종료음은 한 번 울린다.
// 웹은 브라우저 자동재생 제한 때문에 첫 터치에 소리를 미리 깨워야 했지만 앱은 그런 제한이 없다
const RINGTONE = require('@/assets/sounds/idta-ringtone.mp3')
const HANGUP = require('@/assets/sounds/idta-calloff.mp3')
// 휴대폰 전화처럼 벨과 함께 진동한다(쉬고·울리고를 반복)
const VIBRATION_PATTERN = [0, 800, 1200]

let ringtone: AudioPlayer | null = null
let hangup: AudioPlayer | null = null
let modeReady = false

function ensurePlayers() {
  if (!modeReady) {
    modeReady = true
    // 무음 모드에서도 벨이 들려야 전화를 놓치지 않는다
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }
  ringtone ??= createAudioPlayer(RINGTONE)
  hangup ??= createAudioPlayer(HANGUP)
}

export function startRingtone() {
  ensurePlayers()
  if (!ringtone) return
  ringtone.loop = true
  void ringtone.seekTo(0).catch(() => {})
  ringtone.play()
  Vibration.vibrate(VIBRATION_PATTERN, true)
}

export function stopRingtone() {
  Vibration.cancel()
  ringtone?.pause()
}

export function playHangupTone() {
  ensurePlayers()
  if (!hangup) return
  void hangup.seekTo(0).catch(() => {})
  hangup.play()
}
