'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호를 확인해주세요.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  const handleSocial = async (provider: 'kakao' | 'google') => {
    setSocialLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* 배경 오브 */}
      <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-15%', right: '-10%', width: '45vw', height: '45vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* 뒤로 가기 */}
      <button onClick={() => router.push('/')}
        style={{ position: 'fixed', top: 24, left: 24, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#9b8fa8', fontSize: 13, cursor: 'pointer', zIndex: 10, transition: 'all 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
        ← 홈으로
      </button>

      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', zIndex: 10,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all 0.6s ease',
      }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
            💬
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', marginBottom: 6 }}>교랑톡</h1>
          <p style={{ fontSize: 14, color: '#6b5e7e' }}>로그인하고 대화를 시작해보세요</p>
        </div>

        {/* 카드 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '32px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>

          {/* 소셜 로그인 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <button onClick={() => handleSocial('kakao')} disabled={!!socialLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 14, background: '#FEE500', border: 'none', color: '#3A1D1D', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', opacity: socialLoading ? 0.6 : 1 }}
              onMouseEnter={e => !socialLoading && ((e.currentTarget.style.transform = 'translateY(-1px)'), (e.currentTarget.style.boxShadow = '0 6px 20px rgba(254,229,0,0.3)'))}
              onMouseLeave={e => ((e.currentTarget.style.transform = 'translateY(0)'), (e.currentTarget.style.boxShadow = 'none'))}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.1 1.26 3.95 3.18 5.04l-.81 3.03 3.51-2.31c.52.07 1.06.11 1.62.11 4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5z" fill="#3A1D1D"/>
              </svg>
              {socialLoading === 'kakao' ? '로그인 중...' : '카카오로 로그인'}
            </button>

            <button onClick={() => handleSocial('google')} disabled={!!socialLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)', color: '#3C3C3C', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s', opacity: socialLoading ? 0.6 : 1 }}
              onMouseEnter={e => !socialLoading && ((e.currentTarget.style.background = '#fff'), (e.currentTarget.style.transform = 'translateY(-1px)'))}
              onMouseLeave={e => ((e.currentTarget.style.background = 'rgba(255,255,255,0.9)'), (e.currentTarget.style.transform = 'translateY(0)'))}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {socialLoading === 'google' ? '로그인 중...' : '구글로 로그인'}
            </button>
          </div>

          {/* 구분선 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 12, color: '#4a3d5e', whiteSpace: 'nowrap' }}>또는 이메일로</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* 이메일 폼 */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>이메일</label>
              <input type="email" required placeholder="hello@example.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>비밀번호</label>
              <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ padding: '13px', borderRadius: 14, background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 6px 24px rgba(124,58,237,0.35)', marginTop: 4 }}
              onMouseEnter={e => !loading && ((e.currentTarget.style.transform = 'translateY(-1px)'), (e.currentTarget.style.boxShadow = '0 8px 28px rgba(124,58,237,0.45)'))}
              onMouseLeave={e => ((e.currentTarget.style.transform = 'translateY(0)'), (e.currentTarget.style.boxShadow = loading ? 'none' : '0 6px 24px rgba(124,58,237,0.35)'))}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        {/* 회원가입 링크 */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#4a3d5e', marginTop: 20 }}>
          계정이 없으신가요?{' '}
          <a href="/signup" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = 'underline')}
            onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}>
            회원가입
          </a>
        </p>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}