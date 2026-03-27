'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null }
interface GroupRoom { id: string; name: string; description: string | null; created_by: string }
interface GroupMessage { id: string; room_id: string; sender_id: string; content: string; created_at: string }
interface GroupMember { id: string; room_id: string; user_id: string; role: string }

const Avatar = ({ p, size = 36 }: { p: Profile | null | undefined; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative', color: 'white' }}>
    {p?.avatar_url ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} /> : <span>{p?.nickname?.[0] || '?'}</span>}
  </div>
)

export default function GroupChatClient({
  userId, myProfile, room, initialMessages, members, profileMap,
}: {
  userId: string
  myProfile: Profile
  room: GroupRoom
  initialMessages: GroupMessage[]
  members: GroupMember[]
  profileMap: Record<string, Profile>
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [pMap, setPMap] = useState(profileMap)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase.channel(`group:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_group_messages', filter: `room_id=eq.${room.id}` },
        async (payload) => {
          const msg = payload.new as GroupMessage
          setMessages(prev => [...prev, msg])
          if (!pMap[msg.sender_id]) {
            const { data } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', msg.sender_id).single()
            if (data) setPMap(prev => ({ ...prev, [data.id]: data }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room.id])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    await supabase.from('kyorangtalk_group_messages').insert({ room_id: room.id, sender_id: userId, content })
    setSending(false)
  }

  const leaveGroup = async () => {
    if (!confirm('그룹에서 나갈까요?')) return
    await supabase.from('kyorangtalk_group_members').delete().eq('room_id', room.id).eq('user_id', userId)
    router.push('/')
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  }

  const isSameMinute = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return isSameDay(a, b) && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes()
  }

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f7f4ff' }}>

      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 h-14 sticky top-0 z-10" style={{ background: 'rgba(247,244,255,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(108,92,231,0.1)' }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(108,92,231,0.08)', color: '#7c3aed' }}>←</button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: '#2A2035' }}>{room.name}</p>
          <p className="text-xs" style={{ color: '#9B8FA8' }}>{members.length}명</p>
        </div>
        <button onClick={() => setShowMembers(prev => !prev)} className="w-9 h-9 rounded-xl flex items-center justify-center text-sm" style={{ background: showMembers ? 'rgba(124,58,237,0.12)' : 'rgba(108,92,231,0.08)' }}>👥</button>
      </div>

      {/* 멤버 패널 */}
      {showMembers && (
        <div className="flex-shrink-0 px-4 py-3" style={{ background: 'white', borderBottom: '1px solid rgba(108,92,231,0.08)' }}>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {members.map(m => (
              <div key={m.id} className="flex flex-col items-center gap-1 flex-shrink-0">
                <Avatar p={pMap[m.user_id]} size={40} />
                <p className="text-xs text-center truncate" style={{ color: '#9B8FA8', maxWidth: '52px' }}>{pMap[m.user_id]?.nickname || '...'}</p>
                {m.role === 'owner' && <p className="text-xs" style={{ color: '#f59e0b' }}>방장</p>}
              </div>
            ))}
          </div>
          <button onClick={leaveGroup} className="mt-3 w-full py-2 rounded-xl text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>그룹 나가기</button>
        </div>
      )}

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => {
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const isMine = msg.sender_id === userId
          const sender = pMap[msg.sender_id]
          const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
          const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameMinute(prev.created_at, msg.created_at)
          const isLastInGroup = !next || next.sender_id !== msg.sender_id || !isSameMinute(msg.created_at, next.created_at)

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(108,92,231,0.07)', color: '#9B8FA8' }}>
                    {new Date(msg.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirstInGroup ? 'mt-0.5' : 'mt-3'}`}>
                {!isMine && (
                  <div style={{ width: 28, flexShrink: 0 }}>
                    {isLastInGroup && <Avatar p={sender} size={28} />}
                  </div>
                )}
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[72%]`}>
                  {!isMine && isFirstInGroup && <p className="text-xs mb-1 px-1" style={{ color: '#9B8FA8' }}>{sender?.nickname || '알 수 없음'}</p>}
                  <div className="px-3.5 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: isMine ? '#7c3aed' : 'white',
                      color: isMine ? 'white' : '#2A2035',
                      border: isMine ? 'none' : '1px solid rgba(108,92,231,0.12)',
                      borderRadius: isMine ? `18px 18px ${isLastInGroup ? '4px' : '18px'} 18px` : `18px 18px 18px ${isLastInGroup ? '4px' : '18px'}`,
                    }}>
                    {msg.content}
                  </div>
                  {isLastInGroup && <span className="text-xs mt-1 px-1" style={{ color: '#9B8FA8', fontSize: 11 }}>{formatTime(msg.created_at)}</span>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex-shrink-0 flex gap-3 items-end px-4 py-3" style={{ background: 'white', borderTop: '1px solid rgba(108,92,231,0.08)' }}>
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="메시지를 입력하세요..."
          rows={1}
          className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
          style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.15)', color: '#2A2035', maxHeight: '100px' }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30"
          style={{ background: input.trim() ? '#7c3aed' : '#9B8FA8' }}>↑</button>
      </div>
    </div>
  )
}