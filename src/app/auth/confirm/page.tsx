'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push('/')
      else router.push('/login')
    })
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
      <span className="animate-pulse">로그인 중...</span>
    </div>
  )
}