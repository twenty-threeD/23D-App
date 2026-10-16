import { useLocalSearchParams } from 'expo-router'
import ServiceUploadScreen from '@/components/upload/ServiceUploadScreen'

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const postId = Number(id)
  // 다른 글의 수정 화면으로 바로 넘어가도 쓰던 내용이 섞이지 않게 글 번호마다 새로 그린다
  return <ServiceUploadScreen key={id} postId={Number.isInteger(postId) && postId > 0 ? postId : null} />
}
