import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/constants/theme'

type StarRatingProps = {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  onChange?: (rating: number) => void
}

const SIZE = { sm: 14, md: 20, lg: 22 }

// 웹 StarRating 과 같은 규칙: 꽉 찬 별, 반 별(0.5 이상), 빈 별
export default function StarRating({ rating, size = 'md', interactive = false, onChange }: StarRatingProps) {
  const px = SIZE[size]

  return (
    <View style={styles.row} accessibilityRole={interactive ? 'radiogroup' : undefined} accessibilityLabel={interactive ? '별점 선택' : `별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const name = rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'
        const icon = <Ionicons name={name} size={px} color={rating >= star - 0.5 ? colors.main : colors.zinc300} />
        if (!interactive) return <View key={star}>{icon}</View>
        return (
          <Pressable
            key={star}
            onPress={() => onChange?.(star)}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityLabel={`${star}점`}
            accessibilityState={{ checked: rating === star }}
            style={styles.button}
          >
            {icon}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  button: {
    padding: 2,
  },
})
