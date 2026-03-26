'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
}

interface Profile {
  id: string
  nickname: string
  avatar_url: string | null
  status_message: string | null
}

interface Room {
  id: string
  user1_id: string
  user2_id: string
}

const Avatar = ({ p, size = 36 }: { p: Profile; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative', color: 'white' }}>
    {p.avatar_url ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} /> : <span>{p.nickname[0]}</span>}
  </div>
)

export default function ChatRoom({ room, initialMessages, userId, myProfile, partnerProfile }: {
  room: Room
  initialMessages: Message[]
  userId: string
  myProfile: Profile
  partnerProfile: Profile
}) {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const channel = supabase.channel(`room:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${room.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room.id])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const { error } = await supabase.from('kyorangtalk_messages').insert({ room_id: room.id, sender_id: userId, content })
    if (!error) await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', room.id)
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
    const date = new Date(dateStr), now = new Date()
    const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diff = n0.getTime() - d0.getTime()
    if (diff === 0) return '오늘'
    if (diff === 86400000) return '어제'
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  }

  const isSameMinute = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() &&
      da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes()
  }

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  }

  const t = {
    bg: isDark ? '#0f0f14' : '#f0eeff',
    surface: isDark ? '#1a1a24' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)',
    text: isDark ? '#e2d9f3' : '#2A2035',
    muted: isDark ? '#5a5a6e' : '#9B8FA8',
    accent: '#7c3aed',
    myBubble: isDark ? '#6d28d9' : '#7c3aed',
    theirBubble: isDark ? '#1e1e2e' : '#ffffff',
    theirBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.12)',
    datePill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.07)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,92,231,0.15)',
    headerBg: isDark ? 'rgba(15,15,20,0.95)' : 'rgba(255,255,255,0.95)',
    overlay: 'rgba(0,0,0,0.5)',
  }

  const renderMessages = () => {
    const elements: React.ReactNode[] = []
    messages.forEach((msg, i) => {
      const prev = messages[i - 1]
      const next = messages[i + 1]
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      if (showDate) {
        elements.push(
          <div key={`date-${msg.id}`} className="flex items-center justify-center my-6">
            <span className="text-xs px-4 py-1.5 rounded-full" style={{ background: t.datePill, color: t.muted }}>
              {formatDate(msg.created_at)}
            </span>
          </div>
        )
      }
      const isMine = msg.sender_id === userId
      const isLastInGroup = !next || !isSameMinute(msg.created_at, next.created_at) || next.sender_id !== msg.sender_id
      const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameMinute(prev.created_at, msg.created_at)

      elements.push(
        <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirstInGroup ? 'mt-0.5' : 'mt-3'}`}>
          {!isMine && (
            <div style={{ width: 30, flexShrink: 0 }}>
              {isLastInGroup && (
                <button onClick={() => setShowProfile(true)}>
                  <Avatar p={partnerProfile} size={30} />
                </button>
              )}
            </div>
          )}
          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[68%]`}>
            {!isMine && isFirstInGroup && (
              <p className="text-xs mb-1 px-1" style={{ color: t.muted }}>{partnerProfile.nickname}</p>
            )}
            <div className="px-4 py-2.5 text-sm leading-relaxed"
              style={{
                background: isMine ? t.myBubble : t.theirBubble,
                color: isMine ? 'white' : t.text,
                border: isMine ? 'none' : `1px solid ${t.theirBorder}`,
                borderRadius: isMine
                  ? `18px 18px ${isLastInGroup ? '4px' : '18px'} 18px`
                  : `18px 18px 18px ${isLastInGroup ? '4px' : '18px'}`,
              }}>
              {msg.content}
            </div>
            {isLastInGroup && (
              <span className="text-xs mt-1 px-1" style={{ color: t.muted, fontSize: 11 }}>
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
    <div className="flex flex-col h-screen" style={{ background: t.bg }}>

      {/* 헤더 */}
      <header className="flex-shrink-0" style={{ background: t.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}` }}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3 w-full">
          <button onClick={() => router.push('/')} className="w-8 h-8 flex items-center justify-center rounded-full transition-opacity hover:opacity-60" style={{ color: t.muted }}>←</button>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity">
            <Avatar p={partnerProfile} size={34} />
            <div>
              <p className="font-semibold text-sm" style={{ color: t.text }}>{partnerProfile.nickname}</p>
              {partnerProfile.status_message && (
                <p className="text-xs" style={{ color: t.muted, fontSize: 11 }}>{partnerProfile.status_message}</p>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="max-w-4xl mx-auto px-4">
          {mounted && renderMessages()}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 입력창 */}
      <div className="flex-shrink-0" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="메시지를 입력하세요..."
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30"
            style={{ background: input.trim() ? t.accent : t.muted }}>
            ↑
          </button>
        </div>
      </div>

      {/* 프로필 모달 */}
      {showProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: t.overlay }}
          onClick={() => setShowProfile(false)}
        >
          <div
            className="w-80 rounded-3xl overflow-hidden"
            style={{ background: t.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-28 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
              <button onClick={() => setShowProfile(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>✕</button>
            </div>
            <div className="px-5 pb-6 flex flex-col items-center text-center -mt-9">
              <Avatar p={partnerProfile} size={72} />
              <h2 className="text-xl font-bold mt-3 mb-1" style={{ color: t.text }}>{partnerProfile.nickname}</h2>
              {partnerProfile.status_message
                ? <p className="text-sm" style={{ color: t.muted }}>{partnerProfile.status_message}</p>
                : <p className="text-sm" style={{ color: t.muted, opacity: 0.5 }}>상태 메시지 없음</p>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}