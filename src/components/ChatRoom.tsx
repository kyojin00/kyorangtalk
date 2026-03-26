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
  user2_id: string
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kyorangtalk_messages',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room.id])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const { error } = await supabase
      .from('kyorangtalk_messages')
      .insert({ room_id: room.id, sender_id: userId, content })

    if (!error) {
      await supabase
        .from('kyorangtalk_rooms')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', room.id)
    }
    setSending(false)
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return '오늘'
    if (date.toDateString() === yesterday.toDateString()) return '어제'
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const isSameMinute = (a: string, b: string) => {
    const da = new Date(a)
    const db = new Date(b)
    return da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate() &&
      da.getHours() === db.getHours() &&
      da.getMinutes() === db.getMinutes()
  }

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a)
    const db = new Date(b)
    return da.getFullYear() === db.getFullYear() &&
      da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate()
  }

  // 날짜 구분선 + 시간 표시 여부 계산
  const renderMessages = () => {
    const elements: React.ReactNode[] = []

    messages.forEach((msg, i) => {
      const prev = messages[i - 1]
      const next = messages[i + 1]

      // 날짜 구분선
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      if (showDate) {
        elements.push(
          <div key={`date-${msg.id}`} className="flex items-center justify-center my-4">
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(108,92,231,0.08)', color: 'var(--muted)' }}>
              {formatDate(msg.created_at)}
            </span>
          </div>
        )
      }

      const isMine = msg.sender_id === userId

      // 같은 분, 같은 사람이 연속으로 보낼 때 마지막 메시지만 시간 표시
      const isLastInMinuteGroup =
        !next ||
        !isSameMinute(msg.created_at, next.created_at) ||
        next.sender_id !== msg.sender_id

      elements.push(
        <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-0.5`}>
          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
            <div
              className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              style={isMine
                ? { background: 'var(--purple)', color: 'white', borderBottomRightRadius: '4px' }
                : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid rgba(108,92,231,0.1)', borderBottomLeftRadius: '4px' }
              }
            >
              {msg.content}
            </div>
            {isLastInMinuteGroup && (
              <span className="text-xs mt-1 px-1" style={{ color: 'var(--muted)', opacity: 0.6 }}>
                {formatTime(msg.created_at)}
              </span>
            )}
          </div>
        </div>
      )
    })

    return elements
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto" style={{ background: 'var(--bg)' }}>
      <header className="flex-shrink-0" style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }}>
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-lg" style={{ color: 'var(--muted)' }}>←</button>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{partnerNickname}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>나: {myNickname}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4" style={{ background: 'var(--bg)' }}>
        {renderMessages()}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 flex gap-2 items-end" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.1)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="메시지를 입력하세요..."
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.2)', color: 'var(--text)', maxHeight: '120px' }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition flex-shrink-0 disabled:opacity-40"
          style={{ background: 'var(--purple)' }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}