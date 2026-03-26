'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile {
  id: string
  nickname: string
  avatar_url: string | null
  status_message: string | null
}

export default function ProfileClient({ profile, userId }: { profile: Profile; userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDark, setIsDark] = useState(false)

  const [nickname, setNickname] = useState(profile.nickname)
  const [statusMessage, setStatusMessage] = useState(profile.status_message || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  const t = {
    bg: isDark ? '#0f0f14' : '#f7f4ff',
    surface: isDark ? '#1a1a24' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)',
    borderSub: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,92,231,0.06)',
    text: isDark ? '#e2d9f3' : '#2A2035',
    muted: isDark ? '#5a5a6e' : '#9B8FA8',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.04)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,92,231,0.15)',
    accent: '#7c3aed',
    accentLight: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)',
    accentText: isDark ? '#a78bfa' : '#7c3aed',
    headerBg: isDark ? 'rgba(15,15,20,0.95)' : 'rgba(247,244,255,0.95)',
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { setError('사진 업로드에 실패했어요.'); setUploading(false); return }
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
      .update({ nickname: nickname.trim(), status_message: statusMessage.trim() || null, avatar_url: avatarUrl || null })
      .eq('id', userId)
    if (error) {
      setError(error.message.includes('unique') ? '이미 사용 중인 닉네임이에요.' : '저장에 실패했어요.')
    } else {
      setSuccess(true)
      setTimeout(() => { setSuccess(false); router.push('/') }, 800)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>
      <header className="sticky top-0 z-50" style={{ background: t.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="w-8 h-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-60" style={{ color: t.muted }}>←</button>
          <h1 className="text-base font-bold" style={{ color: t.text }}>프로필 수정</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-5">
        {/* 프로필 사진 */}
        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className="relative cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <div
              className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white"
              style={{ width: 96, height: 96, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', position: 'relative', fontSize: 36 }}
            >
              {avatarUrl
                ? <Image src={avatarUrl} alt="프로필" fill style={{ objectFit: 'cover' }} />
                : <span>{nickname[0]}</span>
              }
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <span className="text-white text-xs">업로드 중</span>
                </div>
              )}
            </div>
            <div
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: t.accent, border: `2px solid ${t.bg}` }}
            >
              <span className="text-white text-xs">📷</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <p className="text-xs" style={{ color: t.muted }}>사진을 클릭해서 변경해보세요</p>
        </div>

        {/* 정보 입력 */}
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
            <label className="text-xs font-semibold tracking-wider uppercase block mb-2" style={{ color: t.muted }}>닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="w-full text-sm outline-none"
              style={{ background: 'transparent', color: t.text }}
            />
          </div>
          <div className="px-5 py-4">
            <label className="text-xs font-semibold tracking-wider uppercase block mb-2" style={{ color: t.muted }}>상태 메시지</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="상태 메시지를 입력하세요"
              maxLength={50}
              className="w-full text-sm outline-none"
              style={{ background: 'transparent', color: t.text }}
            />
            <p className="text-xs mt-2 text-right" style={{ color: t.muted }}>{statusMessage.length}/50</p>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl text-sm text-center" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-xl text-sm text-center" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
            저장됐어요!
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, #a78bfa, #7c3aed)` }}
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}