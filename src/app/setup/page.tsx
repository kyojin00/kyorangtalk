'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    <div className="flex flex-col items-center justify-center min-h-screen px-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-6xl block mb-4">🐱</span>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>닉네임 설정</h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>친구들이 나를 찾을 때 쓰는 이름이에요</p>
        </div>
        <form onSubmit={handleSetup} className="rounded-2xl p-8 flex flex-col gap-4" style={{ background: 'white', border: '1px solid rgba(108,92,231,0.1)' }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>닉네임</label>
            <input
              type="text"
              required
              placeholder="2자 이상 입력"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-xs text-center" style={{ color: '#E74C3C' }}>{error}</p>}
          <button type="submit" disabled={loading} className="py-3 rounded-xl font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: 'var(--purple)' }}>
            {loading ? '설정 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}