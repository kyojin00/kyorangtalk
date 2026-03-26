'use client'

import { useState } from 'react'
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
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🐱</span>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>교랑톡</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>로그인하고 익명 채팅을 시작해보세요</p>
        </div>

        {/* 소셜 로그인 */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => handleSocial('kakao')}
            disabled={!!socialLoading}
            className="w-full py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#FEE500', color: '#3A1D1D' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.1 1.26 3.95 3.18 5.04l-.81 3.03 3.51-2.31c.52.07 1.06.11 1.62.11 4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5z" fill="#3A1D1D"/>
            </svg>
            {socialLoading === 'kakao' ? '로그인 중...' : '카카오로 로그인'}
          </button>

          <button
            onClick={() => handleSocial('google')}
            disabled={!!socialLoading}
            className="w-full py-3 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'white', color: '#3C3C3C', border: '1px solid rgba(0,0,0,0.1)' }}
          >
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
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(108,92,231,0.15)' }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>또는 이메일로 로그인</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(108,92,231,0.15)' }} />
        </div>

        {/* 이메일 로그인 */}
        <form onSubmit={handleLogin} className="rounded-2xl p-8 flex flex-col gap-4" style={{ background: 'white', border: '1px solid rgba(108,92,231,0.1)' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>이메일</label>
            <input
              type="email"
              required
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>비밀번호</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-xs text-center" style={{ color: '#E74C3C' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-3 rounded-xl font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--purple)' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          계정이 없으신가요?{' '}
          <a href="/signup" style={{ color: 'var(--purple)' }}>회원가입</a>
        </p>
      </div>
    </div>
  )
}