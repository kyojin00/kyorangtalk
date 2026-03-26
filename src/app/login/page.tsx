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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🐱</span>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>교랑톡</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>교랑 계정으로 로그인하세요</p>
        </div>

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
      </div>
    </div>
  )
}