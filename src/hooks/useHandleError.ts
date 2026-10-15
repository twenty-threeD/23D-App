import { useCallback } from 'react'
import { usePathname, useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { ApiError, isPayloadTooLarge } from '@/lib/apiError'
import { ensureAccessToken } from '@/lib/session'
import { signinHref } from '@/lib/navigation'
import { toast } from '@/components/ui/Toast'

// 휴대폰은 연결이 끊기는 일이 잦은데, fetch 는 그때 영어 문구(Network request failed)를 던져 그대로 보이면 알아보기 어렵다
export function isNetworkError(e: unknown) {
  return e instanceof TypeError && /network|fetch|connect|timeout/i.test(e.message)
}

export function useHandleError() {
  const router = useRouter()
  const pathname = usePathname()

  return useCallback(
    async (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        if (useAuthStore.getState().accessToken) {
          // 액세스 토큰이 만료된 경우이므로 먼저 재발급을 시도한다
          const reissued = await ensureAccessToken()
          if (reissued) {
            toast.error('다시 시도해주세요.')
            return
          }
          useAuthStore.getState().clear()
          // push 로 쌓으면 뒤로가기 할 때마다 로그인 화면으로 되돌아온다.
          // 세션이 끊긴 화면은 기록에 남길 이유가 없으므로 replace 로 치환한다.
          router.replace(signinHref(pathname) as never)
          return
        }
      }
      if (isPayloadTooLarge(e)) {
        toast.error('파일은 최대 25MB까지 업로드할 수 있어요.')
        return
      }
      if (isNetworkError(e)) {
        toast.error('네트워크 연결을 확인해주세요.')
        return
      }
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다.')
    },
    [router, pathname],
  )
}
