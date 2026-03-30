'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthConfirm() {
  const router = useRouter()
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(interval)
  }, [])

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
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* 배경 오브 */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* 로고 */}
      <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, boxShadow: '0 8px 32px rgba(124,58,237,0.4)', animation: 'pulse 2s ease-in-out infinite' }}>
        💬
      </div>

      {/* 로딩 텍스트 */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#e2d9f3', marginBottom: 8 }}>로그인 중{dots}</p>
        <p style={{ fontSize: 13, color: '#4a3d5e' }}>잠시만 기다려주세요</p>
      </div>

      {/* 로딩 바 */}
      <div style={{ width: 160, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a78bfa)', borderRadius: 999, animation: 'loading 1.4s ease-in-out infinite' }} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(124,58,237,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 12px 40px rgba(124,58,237,0.55); }
        }
        @keyframes loading {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}