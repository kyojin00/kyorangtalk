'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, GroupAvatar } from './TalkAvatars'
import { useThemeColors, fmtTime, fmtDate, isSameDay, isSameMin } from './useTheme'
import { OpenChat, Message, GroupMessage, GroupMember, Profile } from './types'

export default function ChatPanel({ openChat, userId, pMap, isDark, onClose, onMarkRead }: {
  openChat: OpenChat
  userId: string
  pMap: Record<string, Profile>
  isDark: boolean
  onClose: (id: string) => void
  onMarkRead: (roomId: string) => void
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([])
  const [gProfiles, setGProfiles] = useState<Record<string, Profile>>({})
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [inviteCode, setInviteCode] = useState(openChat.groupRoom?.invite_code ?? '')
  const [isFriendGroup, setIsFriendGroup] = useState(openChat.groupRoom?.is_friend_group ?? false)
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const t = useThemeColors(isDark)

  const partner = openChat.type === 'dm' && openChat.room
    ? pMap[openChat.room.user1_id === userId ? openChat.room.user2_id : openChat.room.user1_id]
    : null

  useEffect(() => {
    if (openChat.type === 'dm') loadDM()
    else loadGroup()
  }, [openChat.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, groupMessages])

  // 읽음 상태 폴링 (5초마다)
  useEffect(() => {
    if (openChat.type !== 'dm') return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('kyorangtalk_messages')
        .select('id, is_read')
        .eq('room_id', openChat.id)
        .eq('sender_id', userId)
        .eq('is_read', true)
      if (data && data.length > 0) {
        setMessages(prev => prev.map(m => {
          const updated = data.find((d: any) => d.id === m.id)
          return updated ? { ...m, is_read: true } : m
        }))
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [openChat.id, openChat.type])

  useEffect(() => {
    if (openChat.type !== 'dm') return
    const ch = supabase.channel(`dm:${openChat.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${openChat.id}` },
        async (p) => {
          const msg = p.new as Message
          if (msg.sender_id !== userId) {
            setMessages(prev => [...prev, msg])
            await supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('id', msg.id)
            onMarkRead(openChat.id)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${openChat.id}` },
        (p) => setMessages(prev => prev.map(m => m.id === p.new.id ? p.new as Message : m)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [openChat.id, openChat.type])

  useEffect(() => {
    if (openChat.type !== 'group') return
    const ch = supabase.channel(`grp:${openChat.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_group_messages', filter: `room_id=eq.${openChat.id}` },
        async (p) => {
          const msg = p.new as GroupMessage
          if (msg.sender_id !== userId) {
            setGroupMessages(prev => [...prev, msg])
            if (!gProfiles[msg.sender_id]) {
              const { data } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', msg.sender_id).single()
              if (data) setGProfiles(prev => ({ ...prev, [data.id]: data }))
            }
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [openChat.id, openChat.type])

  const loadDM = async () => {
    const { data } = await supabase.from('kyorangtalk_messages').select('*').eq('room_id', openChat.id).order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('room_id', openChat.id).neq('sender_id', userId).eq('is_read', false)
    onMarkRead(openChat.id)
  }

  const loadGroup = async () => {
    const { data: msgs } = await supabase.from('kyorangtalk_group_messages').select('*').eq('room_id', openChat.id).order('created_at', { ascending: true })
    setGroupMessages(msgs || [])

    // 멤버 조회 (RLS 수정으로 전체 멤버 조회 가능)
    const { data: members } = await supabase.from('kyorangtalk_group_members').select('*').eq('room_id', openChat.id)
    if (members) {
      setGroupMembers(members)
      const ids = members.map(m => m.user_id)
      const { data: profiles } = await supabase.from('kyorangtalk_profiles').select('*').in('id', ids)
      if (profiles) {
        const obj: Record<string, Profile> = {}
        profiles.forEach(p => { obj[p.id] = p })
        setGProfiles(obj)
      }
    }

    // 방 정보 조회 (초대코드, 친구그룹 여부)
    const { data: room } = await supabase.from('kyorangtalk_group_rooms').select('invite_code, is_friend_group').eq('id', openChat.id).single()
    if (room) {
      setInviteCode(room.invite_code ?? '')
      setIsFriendGroup(room.is_friend_group ?? false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    if (openChat.type === 'dm') {
      const { data: newMsg } = await supabase
        .from('kyorangtalk_messages')
        .insert({ room_id: openChat.id, sender_id: userId, content, is_read: false })
        .select().single()
      if (newMsg) setMessages(prev => [...prev, newMsg])
      await supabase.from('kyorangtalk_rooms')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', openChat.id)
    } else {
      const { data: newMsg } = await supabase
        .from('kyorangtalk_group_messages')
        .insert({ room_id: openChat.id, sender_id: userId, content })
        .select().single()
      if (newMsg) setGroupMessages(prev => [...prev, newMsg])
    }
    setSending(false)
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveGroup = async () => {
    if (!confirm('그룹에서 나갈까요?')) return
    await supabase.from('kyorangtalk_group_members').delete().eq('room_id', openChat.id).eq('user_id', userId)
    onClose(openChat.id)
  }

  const list = openChat.type === 'dm' ? messages : groupMessages

  const renderMessages = () => list.map((msg, i) => {
    const prev = list[i - 1], next = list[i + 1]
    const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
    const isMine = msg.sender_id === userId
    const isFirst = !prev || prev.sender_id !== msg.sender_id || !isSameMin(prev.created_at, msg.created_at)
    const isLast = !next || next.sender_id !== msg.sender_id || !isSameMin(msg.created_at, next.created_at)
    const sender = openChat.type === 'group' ? gProfiles[msg.sender_id] : partner
    const dmMsg = openChat.type === 'dm' ? msg as Message : null

    return (
      <div key={msg.id}>
        {showDate && (
          <div className="flex items-center justify-center my-4">
            <span className="text-xs px-3 py-1 rounded-full" style={{ background: t.datePill, color: t.muted }}>{fmtDate(msg.created_at)}</span>
          </div>
        )}
        <div className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirst ? 'mt-0.5' : 'mt-3'}`}>
          {!isMine && <div style={{ width: 26, flexShrink: 0 }}>{isLast && <Avatar p={sender} size={26} />}</div>}
          <div className="flex items-end gap-1.5 flex-row max-w-[70%]">
            {/* 시간/읽음 - 버블 왼쪽 하단 */}
            {isLast && (
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0 mb-0.5">
                <span style={{ color: t.muted, fontSize: 10, whiteSpace: 'nowrap' }}>{fmtTime(msg.created_at)}</span>
                {isMine && openChat.type === 'dm' && dmMsg && !dmMsg.is_read && (
                  <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, lineHeight: 1 }}>1</span>
                )}
              </div>
            )}
            <div className="flex flex-col">
              {!isMine && isFirst && <p className="text-xs mb-1 px-1" style={{ color: t.muted }}>{sender?.nickname || '알 수 없음'}</p>}
              <div className="px-3.5 py-2 text-sm leading-relaxed"
                style={{
                  background: isMine ? t.myBubble : t.theirBubble,
                  color: isMine ? 'white' : t.text,
                  border: isMine ? 'none' : `1px solid ${t.theirBorder}`,
                  borderRadius: isMine ? `16px 16px ${isLast ? '4px' : '16px'} 16px` : `16px 16px 16px ${isLast ? '4px' : '16px'}`,
                }}>
                {msg.content}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  })

  return (
    <div className="flex h-full overflow-hidden rounded-2xl" style={{ background: t.bg, border: `1px solid ${t.border}`, minWidth: '300px' }}>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center gap-2.5 px-4 h-12" style={{ background: t.headerBg, borderBottom: `1px solid ${t.border}` }}>
          {openChat.type === 'dm' ? <Avatar p={partner} size={28} /> : <GroupAvatar name={openChat.groupRoom?.name ?? ''} size={28} />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs truncate" style={{ color: t.text }}>
              {openChat.type === 'dm' ? partner?.nickname : openChat.groupRoom?.name}
            </p>
            {openChat.type === 'group' && (
              <p style={{ color: t.muted, fontSize: 10 }}>{groupMembers.length}명</p>
            )}
          </div>
          {openChat.type === 'group' && (
            <button onClick={() => setShowInfo(p => !p)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: showInfo ? 'rgba(124,58,237,0.15)' : t.inputBg, color: showInfo ? '#a78bfa' : t.muted }}>
              👥
            </button>
          )}
          <button onClick={() => onClose(openChat.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs hover:opacity-60"
            style={{ background: t.inputBg, color: t.muted }}>
            ✕
          </button>
        </div>

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {renderMessages()}
          <div ref={bottomRef} />
        </div>

        {/* 입력 */}
        <div className="flex-shrink-0 flex gap-2 items-end px-3 py-3" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
          <textarea ref={inputRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="메시지..." rows={1}
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, maxHeight: '100px' }} />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30 text-xs"
            style={{ background: input.trim() ? t.accent : t.muted }}>↑</button>
        </div>
      </div>

      {/* 그룹 정보 패널 */}
      {showInfo && openChat.type === 'group' && (
        <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 200, borderLeft: `1px solid ${t.border}`, background: t.surface }}>

          {/* 친구 그룹방이 아닐 때만 초대링크 표시 */}
          {!isFriendGroup && (
            <div className="p-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <p className="text-xs font-bold mb-3" style={{ color: t.muted }}>초대 링크</p>
              <button onClick={copyInviteLink}
                className="w-full text-xs py-2 rounded-xl font-medium"
                style={{ background: copied ? 'rgba(124,58,237,0.15)' : t.inputBg, color: copied ? '#a78bfa' : t.muted, border: `1px solid ${t.border}` }}>
                {copied ? '복사됨!' : '🔗 링크 복사'}
              </button>
              <p className="text-xs mt-2 text-center break-all" style={{ color: t.muted, fontSize: 10 }}>코드: {inviteCode}</p>
            </div>
          )}

          {/* 멤버 목록 */}
          <div>
            <p className="px-4 pt-3 pb-1.5 text-xs font-bold" style={{ color: t.muted }}>멤버 {groupMembers.length}명</p>
            {groupMembers.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                <Avatar p={gProfiles[m.user_id]} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: t.text }}>{gProfiles[m.user_id]?.nickname || '...'}</p>
                  {m.role === 'owner' && <p style={{ color: '#f59e0b', fontSize: 10 }}>방장</p>}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4">
            <button onClick={leaveGroup} className="w-full py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>나가기</button>
          </div>
        </div>
      )}
    </div>
  )
}