'use client'

import { useState } from 'react'
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않아요.')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError('회원가입에 실패했어요. 다시 시도해주세요.')
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center" style={{ background: 'var(--bg)' }}>
        <span className="text-6xl block mb-4">🐱</span>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>이메일을 확인해주세요</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          {email} 으로 인증 메일을 보냈어요.<br />메일 확인 후 로그인해주세요.
        </p>
        <a href="/login" className="px-8 py-3 rounded-full text-white text-sm font-medium" style={{ background: 'var(--purple)' }}>로그인하러 가기</a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🐱</span>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>교랑톡 회원가입</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>교랑 계정을 만들면 교랑AI도 함께 쓸 수 있어요</p>
        </div>

        <form onSubmit={handleSignup} className="rounded-2xl p-8 flex flex-col gap-4" style={{ background: 'white', border: '1px solid rgba(108,92,231,0.1)' }}>
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
              placeholder="6자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>비밀번호 확인</label>
            <input
              type="password"
              required
              placeholder="비밀번호 다시 입력"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          이미 계정이 있으신가요?{' '}
          <a href="/login" style={{ color: 'var(--purple)' }}>로그인</a>
        </p>
      </div>
    </div>
  )
}