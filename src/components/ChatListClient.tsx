'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateNickname } from '@/lib/nickname'

interface Room {
  id: string
  user1_id: string
  user2_id: string | null
  user1_nickname: string
  user2_nickname: string
  status: string
  last_message: string | null
  last_message_at: string | null
  updated_at: string
}

export default function ChatListClient({ initialRooms, userId }: { initialRooms: Room[], userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [matching, setMatching] = useState(false)
  const [waitingRoomId, setWaitingRoomId] = useState<string | null>(null)

  const getPartnerNickname = (room: Room) => room.user1_id === userId ? room.user2_nickname : room.user1_nickname

  useEffect(() => {
    const channel = supabase
      .channel('rooms-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyorangtalk_rooms' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const startMatching = async () => {
  setMatching(true)
  try {
    // 세션 확인
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: waitingRooms } = await supabase
      .from('kyorangtalk_rooms')
      .select('*')
      .eq('status', 'waiting')
      .is('user2_id', null)
      .neq('user1_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)

    if (waitingRooms && waitingRooms.length > 0) {
      const room = waitingRooms[0]
      const myNickname = generateNickname()
      const { error } = await supabase
        .from('kyorangtalk_rooms')
        .update({ user2_id: userId, user2_nickname: myNickname, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', room.id)
        .is('user2_id', null)

      if (!error) { router.push(`/chat/${room.id}`); return }
    }

    const myNickname = generateNickname()
    const { data: newRoom, error: insertError } = await supabase
      .from('kyorangtalk_rooms')
      .insert({ user1_id: userId, user1_nickname: myNickname, user2_nickname: '???', status: 'waiting' })
      .select()
      .single()

    if (insertError) {
      console.error('방 생성 실패:', insertError.message)
      alert('채팅방 생성에 실패했어요. 다시 시도해주세요.\n' + insertError.message)
      setMatching(false)
      return
    }

    if (newRoom) {
      setWaitingRoomId(newRoom.id)
      const channel = supabase
        .channel(`match-wait:${newRoom.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_rooms', filter: `id=eq.${newRoom.id}` }, (payload) => {
          if (payload.new.status === 'active') {
            supabase.removeChannel(channel)
            router.push(`/chat/${newRoom.id}`)
          }
        })
        .subscribe()
    }
  } catch (err) {
    console.error(err)
    setMatching(false)
  }
}

  const cancelMatching = async () => {
    if (waitingRoomId) {
      await supabase.from('kyorangtalk_rooms').delete().eq('id', waitingRoomId).eq('user1_id', userId)
      setWaitingRoomId(null)
    }
    setMatching(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }} className="sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--purple-dark)' }}>교랑톡</h1>
            <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>익명 채팅</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-70"
            style={{ color: 'var(--muted)', background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.15)' }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="rounded-2xl p-6 text-center text-white" style={{ background: 'linear-gradient(135deg, var(--purple) 0%, var(--purple-dark) 100%)' }}>
          <p className="text-sm opacity-80 mb-1">비슷한 고민을 가진 누군가와</p>
          <h2 className="text-xl font-bold mb-4">익명으로 대화해보세요</h2>
          {!matching ? (
            <button onClick={startMatching} className="bg-white font-bold px-8 py-3 rounded-full text-sm hover:opacity-90 transition" style={{ color: 'var(--purple)' }}>🐱 랜덤 매칭 시작</button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="animate-pulse">●</span>
                상대방을 찾고 있어요...
              </div>
              <button onClick={cancelMatching} className="text-white text-sm px-6 py-2 rounded-full hover:bg-white/20 transition" style={{ border: '1px solid rgba(255,255,255,0.4)' }}>취소</button>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2 px-1" style={{ color: 'var(--muted)' }}>진행 중인 채팅</h3>
          {rooms.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>
              아직 채팅이 없어요<br />매칭을 시작해보세요 🐱
            </div>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <button key={room.id} onClick={() => router.push(`/chat/${room.id}`)} className="w-full rounded-xl p-4 flex items-center gap-3 hover:opacity-80 transition text-left" style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.1)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: 'var(--purple-light)' }}>👤</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{getPartnerNickname(room)}</span>
                      {room.last_message_at && (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(room.last_message_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{room.last_message || '대화를 시작해보세요'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}