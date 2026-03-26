'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile {
  id: string
  nickname: string
  avatar_url: string | null
  status_message: string | null
}

export default function ProfileClient({ profile, userId }: { profile: Profile, userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState(profile.nickname)
  const [statusMessage, setStatusMessage] = useState(profile.status_message || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('사진 업로드에 실패했어요.')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl + '?t=' + Date.now())
    setUploading(false)
  }

  const handleSave = async () => {
    if (nickname.trim().length < 2) { setError('닉네임은 2자 이상이어야 해요.'); return }
    setSaving(true)
    setError('')

    const { error } = await supabase
      .from('kyorangtalk_profiles')
      .update({
        nickname: nickname.trim(),
        status_message: statusMessage.trim() || null,
        avatar_url: avatarUrl || null,
      })
      .eq('id', userId)

    if (error) {
      setError(error.message.includes('unique') ? '이미 사용 중인 닉네임이에요.' : '저장에 실패했어요.')
    } else {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); router.push('/') }, 1000)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-50" style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="text-lg" style={{ color: 'var(--muted)' }}>←</button>
          <h1 className="text-base font-bold" style={{ color: 'var(--purple-dark)' }}>프로필 수정</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        {/* 프로필 사진 */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center cursor-pointer relative"
            style={{ background: 'var(--purple-light)', border: '3px solid rgba(108,92,231,0.2)' }}
            onClick={() => fileRef.current?.click()}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="프로필" fill style={{ objectFit: 'cover' }} />
            ) : (
              <span className="text-3xl font-bold text-white" style={{ color: 'var(--purple)' }}>
                {nickname[0]}
              </span>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <span className="text-white text-xs">업로드 중...</span>
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs px-4 py-1.5 rounded-full"
            style={{ color: 'var(--purple)', background: 'var(--purple-light)' }}
          >
            사진 변경
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* 닉네임 */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.1)' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>상태 메시지</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="상태 메시지를 입력하세요"
              maxLength={50}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>
        </div>

        {error && <p className="text-xs text-center" style={{ color: '#E74C3C' }}>{error}</p>}
        {success && <p className="text-xs text-center" style={{ color: '#27AE60' }}>저장됐어요!</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--purple)' }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}