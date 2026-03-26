'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/')
        return
      }

      // URL hash에서 토큰 추출 (OAuth implicit flow)
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) {
            router.push('/')
            return
          }
        }
      }

      router.push('/login')
    }

    handleSession()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen text-sm" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
      <span className="animate-pulse">로그인 중...</span>
    </div>
  )
}