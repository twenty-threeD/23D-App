import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { File, Paths } from 'expo-file-system'
import { Ionicons } from '@expo/vector-icons'
import Text from '@/components/ui/Text'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import TextField, { Field } from '@/components/ui/TextField'
import { toast } from '@/components/ui/Toast'
import BackHeader from '@/components/BackHeader'
import LoginRequired from '@/components/LoginRequired'
import { Avatar } from '@/components/PostImage'
import ServiceCard from '@/components/main/ServiceCard'
import AccountEditModal from '@/components/profile/AccountEditModal'
import PasswordModal from '@/components/profile/PasswordModal'
import { colors, PAGE_X, radius } from '@/constants/theme'
import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { useHandleError } from '@/hooks/useHandleError'
import { toAbsoluteUrl, toUploadPath, uploadFile } from '@/lib/file'
import { HeifConversionError } from '@/lib/imageCompress'
import { isPayloadTooLarge } from '@/lib/apiError'
import {
  getJobCategories,
  getMyProfile,
  getSidoList,
  getSigunguList,
  needsPasswordSetup,
  updateMyProfile,
  type JobCategory,
  type Profile,
  type Sido,
  type Sigungu,
} from '@/lib/profile'
import { deleteAccount } from '@/lib/member'
import { logout } from '@/lib/auth'
import { deletePost, getFavoritePosts, getMyPosts, type Post } from '@/lib/post'
import { pickImages } from '@/lib/pickers'
import { confirm } from '@/lib/dialog'
import { SIGNIN_PATH } from '@/lib/navigation'

const DISTANCE_OPTIONS: { value: 'TEN_KM' | 'TWENTY_FIVE_KM' | 'FIFTY_KM' | 'OVER_HUNDRED_KM'; label: string }[] = [
  { value: 'TEN_KM', label: '10km 이내' },
  { value: 'TWENTY_FIVE_KM', label: '25km 이내' },
  { value: 'FIFTY_KM', label: '50km 이내' },
  { value: 'OVER_HUNDRED_KM', label: '100km 이상' },
]
type Distance = (typeof DISTANCE_OPTIONS)[number]['value']

const EXTENSION_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// 서버는 외부(소셜) 사진 주소를 거부하고 사진을 빼면 기본 이미지로 바꾼다. 저장할 때 소셜 사진을 우리 업로드 경로로 옮긴다
async function uploadExternalProfileImage(token: string, imageUrl: string) {
  const downloaded = await File.downloadFileAsync(toAbsoluteUrl(imageUrl), Paths.cache)
  if (downloaded.size > 25 * 1024 * 1024) throw new Error('프로필 사진 파일이 너무 큽니다.')
  const mimeType = (downloaded.type || 'image/jpeg').toLowerCase().split(';')[0]
  if (!mimeType.startsWith('image/')) throw new Error('지원하지 않는 프로필 사진 형식입니다.')
  const extension = EXTENSION_BY_TYPE[mimeType] ?? 'img'
  return uploadFile(token, { uri: downloaded.uri, name: `profile-${Date.now()}.${extension}`, mimeType })
}

interface LoadedProfile {
  data: Profile
  posts: Post[]
}

async function loadProfile(token: string, fallbackUsername: string | null): Promise<LoadedProfile> {
  const { data } = await getMyProfile(token)
  if (data.posts) return { data, posts: data.posts }
  // 프로필 응답에 posts 가 없으면 전체 목록을 훑어 걸러낸다
  const name = data.username ?? fallbackUsername
  return { data, posts: name ? await getMyPosts(token, name).catch(() => []) : [] }
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text size="xl" weight="bold">
      {children}
    </Text>
  )
}

export default function Page() {
  const token = useAuthStore((s) => s.accessToken)
  // 토큰은 만료 직전·앱 복귀 때 재발급된다. 토큰 값에 의존하면 재발급마다 다시 불러와 편집 중인 내용을 덮어써서,
  // 로그인 여부에만 의존하고 요청에는 그 시점의 최신 토큰을 쓴다
  const hasToken = !!token
  const clear = useAuthStore((s) => s.clear)
  const handleError = useHandleError()
  // useHandleError 는 경로가 바뀌면 새 함수를 돌려줘서, 불러오기 의존성에 넣으면 다시 불러오며 수정 중인 값을 덮는다
  const handleErrorRef = useRef(handleError)
  useEffect(() => {
    handleErrorRef.current = handleError
  })
  const { width } = useWindowDimensions()
  const columnWidth = (width - PAGE_X * 2 - 12) / 2

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [resettingImage, setResettingImage] = useState(false)
  const [shortDescription, setShortDescription] = useState('')
  const [jobCategoryId, setJobCategoryId] = useState<number | null>(null)
  const [ctprvnCd, setCtprvnCd] = useState('')
  const [sigCd, setSigCd] = useState('')
  const [movableDistance, setMovableDistance] = useState<Distance | null>(null)
  const [usernameInput, setUsernameInput] = useState('')

  const [jobCategories, setJobCategories] = useState<JobCategory[]>([])
  const [sidoList, setSidoList] = useState<Sido[]>([])
  const [sigunguList, setSigunguList] = useState<Sigungu[]>([])

  const [favorites, setFavorites] = useState<Post[] | null>(null)
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<'email' | 'phone' | null>(null)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [passwordMode, setPasswordMode] = useState<'set' | 'change' | null>(null)

  // 서버 값으로 편집 칸까지 채운다. 세터와 스토어만 써서 매 렌더 같은 함수로 둔다
  const applyProfile = useCallback(({ data, posts }: LoadedProfile) => {
    setProfile(data)
    setImageUrl(data.imageUrl ?? '')
    useProfileStore.getState().setImageUrl(data.imageUrl ?? null)
    setShortDescription(data.shortDescription ?? '')
    setJobCategoryId(data.jobCategoryId ?? null)
    setSigCd(data.sigCd ?? '')
    // 프로필 응답엔 시/도 코드가 없다. 시군구 코드 앞 2자리가 시/도 코드라서 여기서 복원해야 수정 화면이 기존 값으로 채워진다
    setCtprvnCd(data.sigCd ? data.sigCd.slice(0, 2) : '')
    // 서버가 enum 대신 라벨을 줄 때도 있어 둘 다 맞춰 본다
    const distance = DISTANCE_OPTIONS.find(
      (o) => o.value === data.movableDistance || o.label === data.movableDistance || o.label === data.movableDistanceLabel,
    )
    setMovableDistance(distance?.value ?? null)
    setUsernameInput(data.username ?? '')
    setMyPosts(posts)
  }, [])

  // 저장·인증 뒤 서버에 실제로 남은 값으로 화면을 다시 맞춘다
  async function fetchProfile() {
    const current = useAuthStore.getState().accessToken
    if (!current) return
    try {
      applyProfile(await loadProfile(current, useAuthStore.getState().username))
    } catch (e) {
      void handleError(e)
    }
  }

  useEffect(() => {
    const current = useAuthStore.getState().accessToken
    if (!current) return
    let cancelled = false
    loadProfile(current, useAuthStore.getState().username)
      .then((loaded) => {
        if (!cancelled) applyProfile(loaded)
      })
      .catch((e: unknown) => {
        if (!cancelled) void handleErrorRef.current(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    getJobCategories()
      .then((list) => {
        if (!cancelled) setJobCategories(list)
      })
      .catch(() => {})
    getSidoList(current)
      .then((list) => {
        if (!cancelled) setSidoList(list)
      })
      .catch(() => {})
    getFavoritePosts(current)
      .then((list) => {
        if (!cancelled) setFavorites(list)
      })
      .catch(() => {
        if (!cancelled) setFavorites([])
      })
    return () => {
      cancelled = true
    }
  }, [hasToken, applyProfile])

  useEffect(() => {
    const current = useAuthStore.getState().accessToken
    if (!ctprvnCd || !current) return
    let cancelled = false
    getSigunguList(current, ctprvnCd)
      .then((list) => {
        if (!cancelled) setSigunguList(list)
      })
      .catch(() => {
        if (!cancelled) setSigunguList([])
      })
    return () => {
      cancelled = true
    }
  }, [ctprvnCd, hasToken])

  async function handleImageChange() {
    if (!token) return
    const [file] = await pickImages({ multiple: false })
    if (!file) return
    if (file.size != null && file.size > 25 * 1024 * 1024) {
      toast.error('사진은 최대 25MB까지 업로드할 수 있어요.')
      return
    }
    setImagePreview(file.uri)
    setUploadingImage(true)
    try {
      const { url } = await uploadFile(token, file)
      setImageUrl(url)
    } catch (e) {
      toast.error(
        e instanceof HeifConversionError ? e.message : isPayloadTooLarge(e) ? '사진은 최대 25MB까지 업로드할 수 있어요.' : '이미지 업로드에 실패했습니다.',
      )
    } finally {
      setImagePreview(null)
      setUploadingImage(false)
    }
  }

  async function handleSave() {
    if (!token) return
    setSaving(true)
    // 아이디 변경은 별도 API 가 없고 프로필 수정에 함께 실린다. 바뀌지 않았으면 아예 보내지 않는다
    const nextUsername = usernameInput.trim()
    const usernameChanged = !!nextUsername && nextUsername !== profile?.username
    try {
      let nextImageUrl = toUploadPath(imageUrl)
      if (imageUrl && !nextImageUrl) {
        try {
          const { url } = await uploadExternalProfileImage(token, imageUrl)
          nextImageUrl = toUploadPath(url)
          if (!nextImageUrl) throw new Error('업로드된 프로필 사진 경로가 올바르지 않습니다.')
        } catch {
          toast.error('현재 프로필 사진을 보관하지 못했습니다. 사진을 새로 선택한 뒤 다시 저장해주세요.')
          return
        }
      }

      await updateMyProfile(token, {
        username: usernameChanged ? nextUsername : undefined,
        // 이 값을 빼면 서버가 사진을 기본 이미지로 초기화하므로 다른 항목만 고칠 때도 현재 사진을 함께 보낸다
        imageUrl: nextImageUrl ?? undefined,
        sigCd: sigCd || undefined,
        movableDistance: movableDistance ?? undefined,
        // 비운 값도 보내야 지워진다. undefined 로 빼면 서버가 '변경 없음'으로 보고 기존 소개를 남긴다
        shortDescription: shortDescription.trim(),
        jobCategoryId: jobCategoryId ?? undefined,
      })
      // 아이디가 바뀌면 서버가 토큰을 지운다. 지금 토큰은 옛 아이디로 발급돼 다음 요청부터 실패하므로 다시 로그인시킨다
      if (usernameChanged) {
        toast.success('아이디가 변경되었습니다. 다시 로그인해주세요.')
        clear()
        useProfileStore.getState().reset()
        router.replace(SIGNIN_PATH)
        return
      }
      toast.success('프로필이 저장되었습니다.')
      setEditing(false)
      await fetchProfile()
    } catch (e) {
      void handleError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleResetImage() {
    if (!token) return
    if (!(await confirm('프로필 사진을 지우고 기본 프로필을 사용할까요?'))) return
    setResettingImage(true)
    try {
      await updateMyProfile(token, { imageUrl: null })
      // 보낸 값이 아니라 서버에 실제로 남은 값으로 화면을 맞춘다. 헤더도 같은 스토어를 보고 있어 함께 바뀐다
      const { data } = await getMyProfile(token)
      setProfile(data)
      setImageUrl(data.imageUrl ?? '')
      useProfileStore.getState().setImageUrl(data.imageUrl ?? null)
      if (data.imageUrl) {
        // 요청은 성공했는데 이미지가 남아 있으면 서버가 null 을 "변경 없음"으로 받은 것이다. 바뀐 척하지 않고 알린다
        toast.error('프로필 사진을 지우지 못했습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      toast.success('기본 프로필로 변경했습니다.')
    } catch (e) {
      void handleError(e)
    } finally {
      setResettingImage(false)
    }
  }

  async function handleDeletePost(postId: number) {
    if (!token) return
    if (!(await confirm('이 게시글을 삭제하시겠습니까? 되돌릴 수 없습니다.', { confirmText: '삭제', destructive: true }))) return
    setDeletingId(postId)
    try {
      await deletePost(token, postId)
      setMyPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('게시글을 삭제했습니다.')
    } catch (e) {
      void handleError(e)
    } finally {
      setDeletingId(null)
    }
  }

  // 웹은 헤더의 프로필 메뉴에 있었다. 앱은 헤더 사진을 누르면 이 화면으로 오므로 여기에 둔다
  async function handleLogout() {
    if (!(await confirm('로그아웃할까요?', { confirmText: '로그아웃' }))) return
    try {
      await logout(token)
    } catch {
      // 서버 로그아웃이 실패해도 기기에서는 로그아웃한다
    }
    clear()
    useProfileStore.getState().reset()
    router.replace('/')
  }

  async function handleDeleteAccount() {
    if (!token) return
    if (!(await confirm('정말로 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.', { confirmText: '탈퇴', destructive: true }))) return
    try {
      await deleteAccount(token)
      toast.success('회원 탈퇴가 완료되었습니다.')
      clear()
      useProfileStore.getState().reset()
      router.replace('/')
    } catch (e) {
      void handleError(e)
    }
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <BackHeader />
        <LoginRequired />
      </View>
    )
  }

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <BackHeader title="프로필" />
        <Text color={colors.zinc400} align="center" style={styles.message}>
          불러오는 중...
        </Text>
      </View>
    )
  }

  const grid = (posts: Post[], withActions: boolean) => (
    <View style={styles.grid}>
      {posts.map((p) => (
        <View key={p.id} style={[styles.gridItem, { width: columnWidth }]}>
          <ServiceCard post={p} inGrid />
          {withActions ? (
            <View style={styles.postActions}>
              <Button variant="secondary" size="sm" style={styles.flex} onPress={() => router.push(`/upload/${p.id}`)}>
                수정
              </Button>
              <Button variant="dangerOutline" size="sm" style={styles.flex} loading={deletingId === p.id} onPress={() => void handleDeletePost(p.id)}>
                {deletingId === p.id ? '삭제 중...' : '삭제'}
              </Button>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  )

  return (
    <View style={styles.container}>
      <BackHeader title="프로필" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatarColumn}>
              <Pressable onPress={editing && !uploadingImage ? () => void handleImageChange() : undefined} disabled={!editing} accessibilityLabel="프로필 사진 바꾸기">
                {imagePreview ? (
                  <Image source={{ uri: imagePreview }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Avatar uri={imageUrl || null} size={96} style={styles.avatarBorder} />
                )}
                {uploadingImage ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color={colors.white} />
                  </View>
                ) : editing ? (
                  <View style={styles.avatarOverlay}>
                    <Ionicons name="camera-outline" size={28} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
              {/* 저장된 사진이 있을 때만 보여준다. 이미 기본 프로필이면 되돌릴 게 없다 */}
              {profile.imageUrl ? (
                <Button variant="secondary" size="sm" loading={resettingImage} disabled={uploadingImage} onPress={() => void handleResetImage()}>
                  {resettingImage ? '변경 중...' : '기본 프로필 사용하기'}
                </Button>
              ) : null}
            </View>
            <View style={styles.identityTexts}>
              <Text size="xl" weight="bold">
                {profile.username}
              </Text>
              <Text size="sm" color={colors.zinc400}>
                {profile.jobCategoryName || '직종 미설정'} · {profile.locationName || '활동 지역 미설정'}
              </Text>
              {profile.movableDistanceLabel ? (
                <Text size="sm" color={colors.zinc400}>
                  이동 가능 거리: {profile.movableDistanceLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {!editing ? (
            <>
              <Text color={colors.zinc600}>{profile.shortDescription || '자기소개가 없습니다.'}</Text>
              <View style={styles.endRow}>
                <Button variant="secondary" onPress={() => setEditing(true)}>
                  프로필 수정
                </Button>
              </View>
            </>
          ) : (
            <View style={styles.form}>
              <Field label="아이디">
                <TextField value={usernameInput} onChangeText={setUsernameInput} autoCapitalize="none" />
              </Field>
              <Field label="자기소개" hint={`${shortDescription.length} / 100`}>
                <TextField value={shortDescription} onChangeText={(v) => setShortDescription(v.slice(0, 100))} maxLength={100} multiline />
              </Field>
              <Field label="직종">
                <Select
                  title="직종"
                  placeholder="선택 안 함"
                  value={jobCategoryId}
                  options={jobCategories.map((c) => ({ label: c.fullName, value: c.id }))}
                  onChange={setJobCategoryId}
                />
              </Field>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Field label="시/도">
                    <Select
                      title="시/도"
                      value={ctprvnCd}
                      options={sidoList.map((s) => ({ label: s.korName ?? s.ctprvnCd, value: s.ctprvnCd }))}
                      onChange={(value) => {
                        setCtprvnCd(value)
                        setSigCd('')
                      }}
                    />
                  </Field>
                </View>
                <View style={styles.flex}>
                  <Field label="시/군/구">
                    <Select
                      title="시/군/구"
                      value={sigCd}
                      disabled={!ctprvnCd}
                      options={sigunguList.map((s) => ({ label: s.korName ?? s.sigCd, value: s.sigCd }))}
                      onChange={setSigCd}
                    />
                  </Field>
                </View>
              </View>
              <Field label="이동 가능 거리">
                <Select title="이동 가능 거리" placeholder="선택 안 함" value={movableDistance} options={DISTANCE_OPTIONS} onChange={setMovableDistance} />
              </Field>
              <View style={styles.endRow}>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setEditing(false)
                    void fetchProfile()
                  }}
                >
                  취소
                </Button>
                <Button loading={saving} onPress={() => void handleSave()}>
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* 계정 정보 */}
        <View style={styles.section}>
          <SectionTitle>계정 정보</SectionTitle>
          <View style={styles.box}>
            <View style={styles.boxRow}>
              <Text size="sm" color={colors.zinc500}>
                이메일
              </Text>
              <View style={styles.boxValue}>
                <Text size="sm" style={styles.shrink}>
                  {profile.email ?? '등록된 정보가 없습니다'}
                </Text>
                <Pressable onPress={() => setEditingField('email')} hitSlop={6}>
                  <Text size="xs" color={colors.zinc500} style={styles.underline}>
                    변경
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.boxRow, styles.boxDivider]}>
              <Text size="sm" color={colors.zinc500}>
                전화번호
              </Text>
              <View style={styles.boxValue}>
                {profile.phone ? (
                  profile.phoneVerified ? (
                    <View style={styles.verifiedBadge}>
                      <Text size="xs" color={colors.main}>
                        인증됨
                      </Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => setVerifyingPhone(true)} style={styles.verifyBadge}>
                      <Text size="xs" color={colors.white}>
                        인증하기
                      </Text>
                    </Pressable>
                  )
                ) : null}
                <Text size="sm">{profile.phone ?? '등록된 정보가 없습니다'}</Text>
                <Pressable onPress={() => setEditingField('phone')} hitSlop={6}>
                  <Text size="xs" color={colors.zinc500} style={styles.underline}>
                    변경
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        {/* 비밀번호 */}
        <View style={styles.section}>
          <SectionTitle>비밀번호</SectionTitle>
          {needsPasswordSetup(profile) ? (
            <View style={[styles.box, styles.mainBorder]}>
              <View style={styles.boxRow}>
                <View style={styles.flex}>
                  <Text size="sm" weight="semibold" color={colors.main}>
                    비밀번호가 설정되지 않았어요
                  </Text>
                  <Text size="xs" color={colors.zinc500}>
                    비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있어요.
                  </Text>
                </View>
                <Button size="sm" onPress={() => setPasswordMode('set')}>
                  비밀번호 설정
                </Button>
              </View>
            </View>
          ) : (
            <View style={styles.box}>
              <View style={styles.boxRow}>
                <Text size="sm" color={colors.zinc500}>
                  비밀번호
                </Text>
                <View style={styles.boxValue}>
                  <Text size="sm">••••••••</Text>
                  <Pressable onPress={() => setPasswordMode('change')} hitSlop={6}>
                    <Text size="xs" color={colors.zinc500} style={styles.underline}>
                      재설정
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* 내가 올린 서비스 */}
        <View style={styles.section}>
          <SectionTitle>내가 올린 게시글</SectionTitle>
          {myPosts.length === 0 ? (
            <Text size="sm" color={colors.zinc400}>
              등록한 게시글이 없습니다.
            </Text>
          ) : (
            grid(myPosts, true)
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>찜한 목록</SectionTitle>
          {favorites === null ? (
            <Text size="sm" color={colors.zinc400}>
              불러오는 중...
            </Text>
          ) : favorites.length === 0 ? (
            <Text size="sm" color={colors.zinc400}>
              찜한 항목이 없습니다.
            </Text>
          ) : (
            grid(favorites, false)
          )}
        </View>

        <View style={styles.footerActions}>
          <Button variant="secondary" onPress={() => void handleLogout()}>
            로그아웃
          </Button>
          <Pressable onPress={() => void handleDeleteAccount()} hitSlop={6}>
            <Text size="sm" color={colors.red500} style={styles.underline}>
              회원 탈퇴
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {verifyingPhone && profile.phone ? (
        <AccountEditModal
          field="phone"
          token={token}
          verifyOnlyPhone={profile.phone}
          onClose={() => setVerifyingPhone(false)}
          onDone={() => {
            setVerifyingPhone(false)
            void fetchProfile()
          }}
        />
      ) : null}

      {passwordMode ? (
        <PasswordModal
          mode={passwordMode}
          token={token}
          onClose={() => setPasswordMode(null)}
          onDone={() => {
            // 변경 API 는 성공 시 서버에서 토큰을 지워서, 그대로 두면 다음 요청부터 401 이 난다
            if (passwordMode === 'change') {
              clear()
              useProfileStore.getState().reset()
              router.replace(SIGNIN_PATH)
              return
            }
            setPasswordMode(null)
            void fetchProfile()
          }}
        />
      ) : null}

      {editingField ? (
        <AccountEditModal
          field={editingField}
          token={token}
          onClose={() => setEditingField(null)}
          onDone={() => {
            setEditingField(null)
            void fetchProfile()
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  message: { paddingVertical: 80 },
  content: { padding: PAGE_X, gap: 40, paddingBottom: 48 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  underline: { textDecorationLine: 'underline' },
  card: { gap: 24, padding: 20, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatarColumn: { alignItems: 'center', gap: 8 },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarBorder: { borderWidth: 1, borderColor: colors.line },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityTexts: { flex: 1, gap: 4 },
  endRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  section: { gap: 16 },
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
  mainBorder: { borderColor: colors.main },
  boxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 16, paddingVertical: 12 },
  boxDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  boxValue: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  verifiedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.main },
  verifyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.main },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 24 },
  gridItem: { gap: 8 },
  postActions: { flexDirection: 'row', gap: 8 },
  footerActions: { alignItems: 'flex-end', gap: 16 },
})
