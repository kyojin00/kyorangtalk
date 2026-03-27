'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage({ params }: { params: { code: string } }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login'>('loading')
  const [roomName, setRoomName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const join = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('login'); return }

      const { data: room } = await supabase
        .from('kyorangtalk_group_rooms')
        .select('*')
        .eq('invite_code', params.code)
        .single()

      if (!room) { setStatus('error'); return }
      setRoomName(room.name)

      const { data: existing } = await supabase
        .from('kyorangtalk_group_members')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: user.id, role: 'member' })
        await supabase.from('kyorangtalk_group_rooms').update({ member_count: (room.member_count || 1) + 1 }).eq('id', room.id)
      }

      setStatus('success')
      setTimeout(() => router.push('/'), 1500)
    }
    join()
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#f7f4ff' }}>
      <div className="text-center p-8 rounded-3xl bg-white" style={{ boxShadow: '0 4px 32px rgba(124,58,237,0.1)', maxWidth: '360px', width: '100%' }}>
        {status === 'loading' && (
          <>
            <p className="text-4xl mb-4">⏳</p>
            <p className="font-medium" style={{ color: '#2A2035' }}>참여 중...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-4xl mb-4">🎉</p>
            <p className="font-bold text-lg mb-1" style={{ color: '#7c3aed' }}>{roomName}</p>
            <p className="text-sm" style={{ color: '#9B8FA8' }}>그룹에 참여했어요! 이동 중...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-4xl mb-4">😢</p>
            <p className="font-medium mb-4" style={{ color: '#2A2035' }}>유효하지 않은 초대 링크예요</p>
            <button onClick={() => router.push('/')} className="px-6 py-2.5 rounded-full text-white text-sm" style={{ background: '#7c3aed' }}>홈으로</button>
          </>
        )}
        {status === 'login' && (
          <>
            <p className="text-4xl mb-4">🔐</p>
            <p className="font-medium mb-4" style={{ color: '#2A2035' }}>로그인이 필요해요</p>
            <button onClick={() => router.push('/login')} className="px-6 py-2.5 rounded-full text-white text-sm" style={{ background: '#7c3aed' }}>로그인하기</button>
          </>
        )}
      </div>
    </main>
  )
}