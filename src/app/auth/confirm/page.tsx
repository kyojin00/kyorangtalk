'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const handleSession = async () => {
      const hash = window.location.hash
      if (hash) {
        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (!error) {
            await new Promise(r => setTimeout(r, 1000))
            router.replace('/')
            return
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/')
        return
      }

      router.replace('/login')
    }

    handleSession()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
      <span className="text-4xl animate-bounce">🐱</span>
      <p className="text-sm animate-pulse">로그인 중...</p>
    </div>
  )
}