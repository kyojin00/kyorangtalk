'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

interface Room {
  id: string
  status: string
  user1_id: string
  user2_id: string | null
}

export default function ChatRoom({ room, initialMessages, userId, myNickname, partnerNickname }: {
  room: Room
  initialMessages: Message[]
  userId: string
  myNickname: string
  partnerNickname: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [closed, setClosed] = useState(room.status === 'closed')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${room.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_rooms', filter: `id=eq.${room.id}` }, (payload) => {
        if (payload.new.status === 'closed') setClosed(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room.id])

  const sendMessage = async () => {
    if (!input.trim() || sending || closed) return
    setSending(true)
    const content = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const { error } = await supabase.from('kyorangtalk_messages').insert({ room_id: room.id, sender_id: userId, content })
    if (!error) {
      await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', room.id)
    }
    setSending(false)
  }

  const leaveChat = async () => {
    if (!confirm('채팅방을 나가시겠어요? 대화 내용이 사라져요.')) return
    await supabase.from('kyorangtalk_rooms').update({ status: 'closed' }).eq('id', room.id)
    router.push('/')
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto" style={{ background: 'var(--bg)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }} className="shrink-0">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-lg" style={{ color: 'var(--muted)' }}>←</button>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{partnerNickname}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>나: {myNickname}</p>
            </div>
          </div>
          <button onClick={leaveChat} className="text-xs px-3 py-1.5 rounded-full transition" style={{ color: '#E74C3C', background: '#FFF0F0' }}>나가기</button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {room.status === 'waiting' && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
            <span className="animate-pulse">상대방을 기다리고 있어요...</span>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
                <span className="text-xs mb-1 px-1" style={{ color: 'var(--muted)' }}>{isMine ? myNickname : partnerNickname}</span>
                <div className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed" style={isMine ? { background: 'var(--purple)', color: 'white', borderBottomRightRadius: '4px' } : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid rgba(108,92,231,0.1)', borderBottomLeftRadius: '4px' }}>
                  {msg.content}
                </div>
                <span className="text-xs mt-1 px-1" style={{ color: 'var(--muted)', opacity: 0.6 }}>{formatTime(msg.created_at)}</span>
              </div>
            </div>
          )
        })}
        {closed && (
          <div className="text-center py-4 text-xs" style={{ color: 'var(--muted)' }}>채팅이 종료되었어요</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 px-4 py-3 flex gap-2 items-end" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.1)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder={closed ? '채팅이 종료되었어요' : room.status === 'waiting' ? '상대방을 기다리고 있어요...' : '메시지를 입력하세요...'}
          disabled={closed || room.status === 'waiting'}
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)', maxHeight: '120px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending || closed || room.status === 'waiting'}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition shrink-0 disabled:opacity-40"
          style={{ background: 'var(--purple)' }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}