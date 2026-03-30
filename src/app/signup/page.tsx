'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('비밀번호가 일치하지 않아요.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError('회원가입에 실패했어요. 다시 시도해주세요.'); setLoading(false) }
    else setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'fixed', top: '-20%', left: '-15%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{
          textAlign: 'center', position: 'relative', zIndex: 10, maxWidth: 400, width: '100%',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.6s ease',
        }}>
          <div style={{ width: 72, height: 72, borderRadius: 22, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(124,58,237,0.4)' }}>
            ✉️
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', marginBottom: 12 }}>이메일을 확인해주세요</h2>
          <p style={{ fontSize: 14, color: '#6b5e7e', lineHeight: 1.7, marginBottom: 32 }}>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>{email}</span>으로<br />인증 메일을 보냈어요. 메일 확인 후 로그인해주세요.
          </p>
          <button onClick={() => router.push('/login')}
            style={{ padding: '13px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 24px rgba(124,58,237,0.35)' }}>
            로그인하러 가기 →
          </button>
        </div>
      </div>
    )
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
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', marginBottom: 6 }}>교랑톡 회원가입</h1>
          <p style={{ fontSize: 14, color: '#6b5e7e' }}>교랑 계정을 만들면 교랑AI도 함께 쓸 수 있어요</p>
        </div>

        {/* 카드 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '32px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>이메일</label>
              <input type="email" required placeholder="hello@example.com" value={email} onChange={e => setEmail(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>비밀번호</label>
              <input type="password" required placeholder="6자 이상" value={password} onChange={e => setPassword(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(124,58,237,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#9b8fa8', letterSpacing: '0.3px' }}>비밀번호 확인</label>
              <input type="password" required placeholder="비밀번호 다시 입력" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: confirm && password && confirm !== password ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.1)', color: '#e2d9f3', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(124,58,237,0.5)')}
                onBlur={e => (e.target.style.borderColor = confirm && password && confirm !== password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)')} />
              {confirm && password && confirm !== password && (
                <p style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>비밀번호가 일치하지 않아요</p>
              )}
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
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>
        </div>

        {/* 로그인 링크 */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#4a3d5e', marginTop: 20 }}>
          이미 계정이 있으신가요?{' '}
          <a href="/login" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = 'underline')}
            onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}>
            로그인
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