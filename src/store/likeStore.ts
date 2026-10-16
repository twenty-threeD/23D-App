import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// 커뮤니티 응답에 "내가 좋아요 했는지"가 빠지는 경우가 있어, 누른 글을 기기에 기억해 둔다(웹은 localStorage)
interface LikeStore {
  likedPosts: number[]
  like: (postId: number) => void
  unlike: (postId: number) => void
  isLiked: (postId: number) => boolean
}

export const useLikeStore = create<LikeStore>()(
  persist(
    (set, get) => ({
      likedPosts: [],
      like: (postId) => set((s) => ({ likedPosts: s.likedPosts.includes(postId) ? s.likedPosts : [...s.likedPosts, postId] })),
      unlike: (postId) => set((s) => ({ likedPosts: s.likedPosts.filter((id) => id !== postId) })),
      isLiked: (postId) => get().likedPosts.includes(postId),
    }),
    { name: 'like-store', storage: createJSONStorage(() => AsyncStorage) },
  ),
)
