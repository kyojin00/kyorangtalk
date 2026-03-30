'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nickname.trim().length < 2) { setError('닉네임은 2자 이상이어야 해요.'); return }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase
      .from('kyorangtalk_profiles')
      .insert({ id: user.id, nickname: nickname.trim() })

    if (error) {
      setError(error.message.includes('unique') ? '이미 사용 중인 닉네임이에요.' : '오류가 발생했어요.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* 배경 오브 */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', right: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', zIndex: 10,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.6s ease',
      }}>

        {/* 로고 + 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
            💬
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', marginBottom: 6 }}>닉네임 설정</h1>
          <p style={{ fontSize: 14, color: '#6b5e7e' }}>친구들이 나를 찾을 때 쓰는 이름이에요</p>
        </div>

        {/* 카드 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '32px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>닉네임</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  required
                  placeholder="2자 이상 입력해주세요"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={20}
                  style={{ width: '100%', padding: '12px 50px 12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: nickname.length >= 18 ? '#f59e0b' : '#4a3d5e', fontWeight: 500 }}>
                  {nickname.length}/20
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#4a3d5e' }}>2~20자, 나중에 변경할 수 있어요</p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || nickname.trim().length < 2}
              style={{ padding: '13px', borderRadius: 14, background: (loading || nickname.trim().length < 2) ? 'rgba(124,58,237,0.35)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: (loading || nickname.trim().length < 2) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: (loading || nickname.trim().length < 2) ? 'none' : '0 6px 24px rgba(124,58,237,0.35)', marginTop: 4 }}
              onMouseEnter={e => { if (!loading && nickname.trim().length >= 2) { (e.currentTarget.style.transform = 'translateY(-1px)'); (e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.45)') } }}
              onMouseLeave={e => { (e.currentTarget.style.transform = 'translateY(0)'); (e.currentTarget.style.boxShadow = (loading || nickname.trim().length < 2) ? 'none' : '0 6px 24px rgba(124,58,237,0.35)') }}>
              {loading ? '설정 중...' : '교랑톡 시작하기 →'}
            </button>
          </form>
        </div>

        {/* 안내 */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['닉네임은 다른 사용자에게 공개돼요', '욕설·비하 닉네임은 제재될 수 있어요'].map((txt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#4a3d5e', flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: '#4a3d5e' }}>{txt}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}