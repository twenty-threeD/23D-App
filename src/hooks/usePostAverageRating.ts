import { useEffect, useState } from 'react'
import { getReviews } from '@/lib/review'

// 목록 응답(PostResponse)에 평점이 없고 서버의 평점 요약도 글이 아니라 회원 단위라, 카드마다 그 글의 리뷰를 받아 평균을 낸다.
// 웹은 이 값을 0.0 으로 두지만 전시·실사용에서 모든 카드가 0.0 으로 보여 앱은 실제 평균을 보여준다.
// 상세 화면과 같은 getReviews 캐시를 써서 같은 글은 다시 받지 않는다. 리뷰를 못 받으면 0.0 으로 둔다
export function usePostAverageRating(postId: number) {
  const [average, setAverage] = useState(0)

  useEffect(() => {
    let alive = true
    getReviews(postId)
      .then((reviews) => {
        if (!alive) return
        setAverage(reviews.length > 0 ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [postId])

  return average
}
