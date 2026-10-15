import { useLocalSearchParams } from 'expo-router'
import CommunityWriteScreen from '@/components/community/CommunityWriteScreen'

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <CommunityWriteScreen postId={Number(id) || null} />
}
