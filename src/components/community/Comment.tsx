import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Text from '@/components/ui/Text'
import TextField from '@/components/ui/TextField'
import { Avatar } from '@/components/PostImage'
import { colors } from '@/constants/theme'

interface CommentProps {
  authorName: string
  content: string
  createdAt: string
  profileImage?: string | null
  edited?: boolean
  isOwner?: boolean
  onEdit?: (content: string) => Promise<void> | void
  onDelete?: () => Promise<void> | void
}

export default function Comment({ authorName, content, createdAt, profileImage, edited, isOwner, onEdit, onDelete }: CommentProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    if (!draft.trim() || !onEdit) return
    setSubmitting(true)
    try {
      await onEdit(draft)
      setEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.row}>
      <Avatar uri={profileImage} size={48} style={styles.avatar} />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text weight="bold">{authorName}</Text>
          {isOwner && !editing ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  setDraft(content)
                  setEditing(true)
                }}
                hitSlop={6}
              >
                <Text size="xs" color={colors.zinc400}>
                  수정
                </Text>
              </Pressable>
              <Pressable onPress={() => void onDelete?.()} hitSlop={6}>
                <Text size="xs" color={colors.red400}>
                  삭제
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.editor}>
            <TextField value={draft} onChangeText={setDraft} multiline containerStyle={styles.editInput} />
            <View style={styles.editActions}>
              <Pressable onPress={() => setEditing(false)} hitSlop={6}>
                <Text size="xs" color={colors.zinc400}>
                  취소
                </Text>
              </Pressable>
              <Pressable onPress={() => void handleSave()} disabled={submitting} hitSlop={6}>
                <Text size="xs" weight="semibold" color={colors.main}>
                  {submitting ? '저장 중...' : '저장'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text size="sm" weight="medium">
            {content}
          </Text>
        )}

        <View style={styles.meta}>
          <Text size="sm" weight="medium" color={colors.zinc400}>
            {createdAt}
          </Text>
          {edited ? (
            <Text size="xs" color={colors.zinc400}>
              (수정됨)
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  avatar: { borderWidth: 1, borderColor: colors.line },
  body: { flex: 1, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 8 },
  editor: { gap: 8 },
  editInput: { minHeight: 60 },
  editActions: { flexDirection: 'row', gap: 12, alignSelf: 'flex-end' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
