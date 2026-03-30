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
  const [mounted, setMounted] = useState(false)

  const [nickname, setNickname] = useState(profile.nickname)
  const [statusMessage, setStatusMessage] = useState(profile.status_message || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => { setMounted(true) }, [])

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
    <div style={{ minHeight: '100vh', background: '#080810', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* 배경 오브 */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', right: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* 헤더 */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,16,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/')}
            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9b8fa8', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}>
            ←
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#e2d9f3' }}>프로필 수정</h1>
        </div>
      </header>

      <div style={{
        maxWidth: 520, margin: '0 auto', padding: '32px 20px 48px',
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.5s ease', position: 'relative', zIndex: 10,
      }}>

        {/* 프로필 사진 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 32px rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 700, color: '#fff' }}>
              {avatarUrl
                ? <Image src={avatarUrl} alt="프로필" fill style={{ objectFit: 'cover' }} />
                : <span>{nickname[0]}</span>
              }
              {uploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>업로드 중</span>
                </div>
              )}
            </div>
            {/* 카메라 버튼 */}
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: '50%', background: '#7c3aed', border: '2px solid #080810', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              📷
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          <p style={{ fontSize: 12, color: '#4a3d5e' }}>사진을 클릭해서 변경해보세요</p>
        </div>

        {/* 입력 카드 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden', marginBottom: 16, backdropFilter: 'blur(20px)' }}>
          {/* 닉네임 */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b5e7e', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>닉네임</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2d9f3', fontSize: 15, fontWeight: 500 }}
                placeholder="닉네임을 입력하세요" />
              <span style={{ fontSize: 11, color: nickname.length >= 18 ? '#f59e0b' : '#4a3d5e', flexShrink: 0, marginLeft: 8 }}>{nickname.length}/20</span>
            </div>
          </div>
          {/* 상태 메시지 */}
          <div style={{ padding: '18px 20px' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b5e7e', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>상태 메시지</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <input type="text" value={statusMessage} onChange={e => setStatusMessage(e.target.value)} maxLength={50}
                placeholder="상태 메시지를 입력하세요"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2d9f3', fontSize: 15 }} />
              <span style={{ fontSize: 11, color: statusMessage.length >= 45 ? '#f59e0b' : '#4a3d5e', flexShrink: 0, marginLeft: 8 }}>{statusMessage.length}/50</span>
            </div>
          </div>
        </div>

        {/* 에러/성공 메시지 */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
            ✓ 저장됐어요!
          </div>
        )}

        {/* 저장 버튼 */}
        <button onClick={handleSave} disabled={saving || nickname.trim().length < 2}
          style={{ width: '100%', padding: '14px', borderRadius: 16, background: (saving || nickname.trim().length < 2) ? 'rgba(124,58,237,0.35)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: (saving || nickname.trim().length < 2) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: (saving || nickname.trim().length < 2) ? 'none' : '0 6px 24px rgba(124,58,237,0.35)' }}
          onMouseEnter={e => { if (!saving && nickname.trim().length >= 2) { (e.currentTarget.style.transform = 'translateY(-1px)'); (e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.45)') } }}
          onMouseLeave={e => { (e.currentTarget.style.transform = 'translateY(0)'); (e.currentTarget.style.boxShadow = (saving || nickname.trim().length < 2) ? 'none' : '0 6px 24px rgba(124,58,237,0.35)') }}>
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.18) !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}