import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center" style={{ background: 'var(--bg)' }}>
      <span className="text-6xl">🐱</span>
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--purple-dark)' }}>교랑톡</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>교랑 계정으로 로그인하면 익명 채팅을 시작할 수 있어요</p>
      </div>
      <a href="https://kyorang.ai.kr/login?next=https://talk.kyorang.com" className="px-8 py-4 rounded-full text-white font-medium transition-opacity hover:opacity-80" style={{ background: 'var(--purple)' }}>교랑으로 로그인하기</a>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>교랑 계정이 없으신가요? <a href="https://kyorang.ai.kr/signup" style={{ color: 'var(--purple)' }}>회원가입</a></p>
    </div>
  )
}