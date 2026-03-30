'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, GroupAvatar } from './TalkAvatars'
import { useThemeColors, fmtTime, fmtDate, isSameDay, isSameMin } from './useTheme'
import { OpenChat, Message, GroupMessage, GroupMember, Profile } from './types'

export default function ChatPanel({ openChat, userId, pMap, isDark, onClose, onMarkRead, onLeaveGroup, onMessageSent, friendList }: {
  openChat: OpenChat
  userId: string
  pMap: Record<string, Profile>
  isDark: boolean
  onClose: (id: string) => void
  onMarkRead: (roomId: string) => void
  onLeaveGroup: (roomId: string) => void
  onMessageSent: (roomId: string, content: string, type: 'dm' | 'group') => void
  friendList?: { id: string; requester_id: string; receiver_id: string }[]
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
  const roomType = openChat.groupRoom?.room_type ?? 'group' // 'open' | 'group'
  const [copied, setCopied] = useState(false)
  const [kickingId, setKickingId] = useState<string | null>(null)
  const [roomDeleted, setRoomDeleted] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  // { user_id: last_read_at } — 멤버별 마지막 읽은 시각
  const [readMap, setReadMap] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const groupSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const t = useThemeColors(isDark)

  const partner = openChat.type === 'dm' && openChat.room
    ? pMap[openChat.room.user1_id === userId ? openChat.room.user2_id : openChat.room.user1_id]
    : null

  const isOwner = groupMembers.find(m => m.user_id === userId)?.role === 'owner'

  // DM 메시지 로드
  useEffect(() => {
    if (openChat.type !== 'dm' || !openChat.room) return
    const roomId = openChat.room.id

    const load = async () => {
      const { data } = await supabase
        .from('kyorangtalk_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
      setMessages(data ?? [])
      // 읽음 처리
      await supabase.from('kyorangtalk_messages')
        .update({ is_read: true })
        .eq('room_id', roomId)
        .neq('sender_id', userId)
      onMarkRead(roomId)
    }
    load()

    const sub = supabase.channel(`dm-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${roomId}` }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        if ((payload.new as Message).sender_id !== userId) {
          supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('id', payload.new.id)
          onMarkRead(roomId)
        }
      })
      // 읽음 처리 반영 (상대방이 읽었을 때 is_read 업데이트)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${roomId}` }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m))
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [openChat.id])

  // 그룹 메시지 로드
  useEffect(() => {
    if (openChat.type !== 'group' || !openChat.groupRoom) return
    const roomId = openChat.groupRoom.id

    const loadGroup = async () => {
      const { data: msgs } = await supabase
        .from('kyorangtalk_group_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
      setGroupMessages(msgs ?? [])

      const { data: members } = await supabase
        .from('kyorangtalk_group_members')
        .select('*')
        .eq('room_id', roomId)
      setGroupMembers(members ?? [])

      // 프로필 로드
      const uids = [...new Set((members ?? []).map(m => m.user_id))]
      if (uids.length > 0) {
        const { data: profiles } = await supabase
          .from('kyorangtalk_profiles')
          .select('*')
          .in('id', uids)
        const map: Record<string, Profile> = {}
        ;(profiles ?? []).forEach(p => { map[p.id] = p })
        setGProfiles(map)
      }

      // 멤버별 읽음 시각 로드
      const { data: reads } = await supabase
        .from('kyorangtalk_group_reads')
        .select('user_id, last_read_at')
        .eq('room_id', roomId)
      const rm: Record<string, string> = {}
      ;(reads ?? []).forEach(r => { rm[r.user_id] = r.last_read_at })
      setReadMap(rm)

      // 내 읽음 처리 + 다른 멤버에게 broadcast
      const now = new Date().toISOString()
      await supabase.from('kyorangtalk_group_reads')
        .upsert({ room_id: roomId, user_id: userId, last_read_at: now }, { onConflict: 'room_id,user_id' })
      setReadMap(prev => ({ ...prev, [userId]: now }))
      onMarkRead(roomId)
      // 내가 읽었다고 다른 멤버에게 알림
      groupSubRef.current?.send({
        type: 'broadcast', event: 'message_read',
        payload: { user_id: userId, last_read_at: now }
      })
    }
    loadGroup()

    const sub = supabase.channel(`group-${roomId}`)
    groupSubRef.current = sub
    sub
      .on('broadcast', { event: 'new_message' }, async payload => {
        const newMsg = payload.payload as GroupMessage
        if (newMsg.sender_id === userId) return
        setGroupMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        const now = new Date().toISOString()
        await supabase.from('kyorangtalk_group_reads')
          .upsert({ room_id: roomId, user_id: userId, last_read_at: now }, { onConflict: 'room_id,user_id' })
        setReadMap(prev => ({ ...prev, [userId]: now }))
        onMarkRead(roomId)
        // 내가 읽었다고 broadcast
        groupSubRef.current?.send({
          type: 'broadcast', event: 'message_read',
          payload: { user_id: userId, last_read_at: now }
        })
      })
      // 다른 멤버가 읽었을 때 readMap 즉시 업데이트
      .on('broadcast', { event: 'message_read' }, ({ payload }) => {
        if (payload.user_id && payload.last_read_at) {
          setReadMap(prev => ({ ...prev, [payload.user_id]: payload.last_read_at }))
        }
      })
      .on('broadcast', { event: 'owner_left' }, () => {
        // 오픈방 방장이 나감 - 멤버 목록 갱신
        supabase.from('kyorangtalk_group_members').select('*').eq('room_id', roomId).then(({ data }) => {
          setGroupMembers(data ?? [])
        })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kyorangtalk_group_members',
        filter: `room_id=eq.${roomId}`
      }, async () => {
        const { data: members } = await supabase.from('kyorangtalk_group_members').select('*').eq('room_id', roomId)
        setGroupMembers(members ?? [])
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'kyorangtalk_group_rooms',
        filter: `id=eq.${roomId}`,
      }, () => {
        setRoomDeleted(true)
        onLeaveGroup(roomId)
      })
      .subscribe(status => {
        console.log(`[그룹 Realtime ${roomId}]`, status)
      })

    return () => { supabase.removeChannel(sub) }
  }, [openChat.id])

  // 스크롤 하단 고정
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, groupMessages])

  // DM 전송
  const sendDm = async () => {
    if (!input.trim() || !openChat.room || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    const now = new Date().toISOString()
    await supabase.from('kyorangtalk_messages').insert({ room_id: openChat.room!.id, sender_id: userId, content })
    await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: now }).eq('id', openChat.room.id)
    // broadcast로 상대방 목록 즉시 갱신
    await supabase.channel(`room-update-${openChat.room.id}`).send({
      type: 'broadcast', event: 'new_message',
      payload: { room_id: openChat.room.id, content, created_at: now, sender_id: userId, type: 'dm' }
    })
    onMessageSent(openChat.room.id, content, 'dm')
    setSending(false)
    inputRef.current?.focus()
  }

  // 그룹 전송
  const sendGroup = async () => {
    if (!input.trim() || !openChat.groupRoom || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    // 낙관적 업데이트 - 내 메시지 바로 표시
    const tempMsg: GroupMessage = { id: tempId, room_id: openChat.groupRoom.id, sender_id: userId, content, created_at: now, msg_type: 'message' }
    setGroupMessages(prev => [...prev, tempMsg])
    const { data, error } = await supabase.from('kyorangtalk_group_messages').insert({ room_id: openChat.groupRoom!.id, sender_id: userId, content, msg_type: 'message' }).select().single()
    if (error) {
      console.error('[그룹 메시지 전송 에러]', JSON.stringify(error))
      setGroupMessages(prev => prev.filter(m => m.id !== tempId))
    } else if (data) {
      setGroupMessages(prev => prev.map(m => m.id === tempId ? data as GroupMessage : m))
      // 같은 채널로 broadcast → 상대방 채팅창 즉시 반영
      await groupSubRef.current?.send({
        type: 'broadcast', event: 'new_message', payload: data
      })
      // HomeClient 목록용 broadcast
      await supabase.channel(`room-update-${openChat.groupRoom!.id}`).send({
        type: 'broadcast', event: 'new_message',
        payload: { room_id: openChat.groupRoom!.id, content, created_at: now, sender_id: userId, type: 'group' }
      })
      onMessageSent(openChat.groupRoom!.id, content, 'group')
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleSend = () => openChat.type === 'dm' ? sendDm() : sendGroup()

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // 그룹 나가기
  const leaveGroup = async () => {
    if (!openChat.groupRoom) return
    const roomId = openChat.groupRoom.id
    const myNick = gProfiles[userId]?.nickname || '누군가'

    if (roomType === 'open' && isOwner) {
      // 오픈방 방장 나가기 → 방 유지
      if (!confirm('오픈방을 나가시겠어요?\n방은 유지되지만 채팅이 비활성화됩니다.')) return
      await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${myNick}님(방장)이 나갔어요. 채팅이 비활성화됩니다.`, msg_type: 'system' })
      await groupSubRef.current?.send({ type: 'broadcast', event: 'owner_left', payload: {} })
    } else if (roomType === 'open') {
      // 오픈방 일반 멤버
      if (!confirm('채팅방을 나가시겠어요?')) return
      await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${myNick}님이 나갔어요.`, msg_type: 'system' })
    } else {
      // 그룹방 - 방장 개념 없이 누구나 그냥 나가기
      if (!confirm('채팅방을 나가시겠어요?')) return
      await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${myNick}님이 나갔어요.`, msg_type: 'system' })
      await groupSubRef.current?.send({
        type: 'broadcast', event: 'new_message',
        payload: { id: crypto.randomUUID(), room_id: roomId, sender_id: userId, content: `${myNick}님이 나갔어요.`, created_at: new Date().toISOString(), msg_type: 'system' }
      })
    }

    onLeaveGroup(roomId)
    onClose(openChat.id)
  }

  // 친구 초대 (그룹방)
  const inviteFriend = async (friendUserId: string) => {
    if (!openChat.groupRoom) return
    setInvitingId(friendUserId)
    const roomId = openChat.groupRoom.id
    const { data: ex } = await supabase.from('kyorangtalk_group_members').select('id').eq('room_id', roomId).eq('user_id', friendUserId).maybeSingle()
    if (ex) { alert('이미 멤버예요!'); setInvitingId(null); return }
    await supabase.from('kyorangtalk_group_members').insert({ room_id: roomId, user_id: friendUserId, role: 'member' })
    const friendNick = pMap[friendUserId]?.nickname || '친구'
    await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${friendNick}님이 초대됐어요.`, msg_type: 'system' })
    await groupSubRef.current?.send({
      type: 'broadcast', event: 'new_message',
      payload: { id: crypto.randomUUID(), room_id: roomId, sender_id: userId, content: `${friendNick}님이 초대됐어요.`, created_at: new Date().toISOString(), msg_type: 'system' }
    })
    setInvitingId(null)
  }

  // 멤버 내보내기 (방장 전용)
  const kickMember = async (member: GroupMember) => {
    if (!openChat.groupRoom || !isOwner) return
    const targetNick = gProfiles[member.user_id]?.nickname || '멤버'
    if (!confirm(`${targetNick}님을 내보내시겠어요?`)) return
    setKickingId(member.user_id)
    const roomId = openChat.groupRoom.id
    const myNick = gProfiles[userId]?.nickname || '방장'
    await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', member.user_id)
    await supabase.from('kyorangtalk_group_messages').insert({
      room_id: roomId,
      sender_id: userId,
      content: `${targetNick}님이 내보내졌어요.`,
      msg_type: 'system',
    })
    setKickingId(null)
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasOwner = openChat.type !== 'group' || groupMembers.some(m => m.role === 'owner')
  const inputDisabled = roomDeleted || (openChat.type === 'group' && !hasOwner)

  const title = openChat.type === 'dm'
    ? partner?.nickname ?? '...'
    : openChat.groupRoom?.name ?? '그룹'

  const renderMessages = () => {
    const msgs = openChat.type === 'dm' ? messages : groupMessages
    return msgs.map((msg, i) => {
      const prev = msgs[i - 1]
      const isMine = msg.sender_id === userId
      const isSystem = (msg as GroupMessage).msg_type === 'system'
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      const showAvatar = !isMine && openChat.type === 'group' && (!prev || prev.sender_id !== msg.sender_id || !isSameMin(prev.created_at, msg.created_at))
      const hideTime = i < msgs.length - 1 && msgs[i + 1].sender_id === msg.sender_id && isSameMin(msg.created_at, msgs[i + 1].created_at)
      const senderProfile = openChat.type === 'group' ? gProfiles[msg.sender_id] : (isMine ? undefined : partner)

      // 그룹방 안읽은 멤버 수 (내가 보낸 메시지에만 표시)
      let unreadCount: number | null = null
      if (openChat.type === 'group' && isMine && !isSystem) {
        const otherMembers = groupMembers.filter(m => m.user_id !== userId)
        const readCount = otherMembers.filter(m => {
          const lastRead = readMap[m.user_id]
          return lastRead && lastRead >= msg.created_at
        }).length
        unreadCount = otherMembers.length - readCount
      }

      // DM 안읽음 여부 (내가 보낸 메시지, 상대가 아직 안 읽은 경우)
      const dmUnread = openChat.type === 'dm' && isMine && !(msg as Message).is_read

      return (
        <div key={msg.id}>
          {showDate && (
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px" style={{ background: t.borderSub }} />
              <span className="text-xs" style={{ color: t.label }}>{fmtDate(msg.created_at)}</span>
              <div className="flex-1 h-px" style={{ background: t.borderSub }} />
            </div>
          )}
          {isSystem ? (
            <div className="flex justify-center my-2">
              <span className="px-3 py-1 rounded-full text-xs" style={{ background: t.surface, color: t.muted }}>{msg.content}</span>
            </div>
          ) : (
            <div className={`flex gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
              <div style={{ width: 28, flexShrink: 0, alignSelf: 'flex-end' }}>
                {showAvatar && !isMine && <Avatar p={senderProfile} size={28} />}
              </div>
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                {showAvatar && !isMine && openChat.type === 'group' && (
                  <p className="text-xs mb-0.5 ml-1" style={{ color: t.muted }}>{senderProfile?.nickname ?? '...'}</p>
                )}
                <div className="flex items-end gap-1.5" style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}>
                  <div className="px-3 py-2 rounded-2xl text-sm break-words" style={{
                    background: isMine ? t.accent : t.surface,
                    color: isMine ? '#fff' : t.text,
                    borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    maxWidth: '100%',
                  }}>
                    {msg.content}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    {/* 그룹방 안읽은 멤버 수 */}
                    {unreadCount !== null && unreadCount > 0 && (
                      <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{unreadCount}</span>
                    )}
                    {/* DM 안읽음 → 1 표시 */}
                    {dmUnread && (
                      <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>1</span>
                    )}
                    {!hideTime && (
                      <span className="text-xs" style={{ color: t.label, fontSize: 10 }}>{fmtTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-full rounded-2xl overflow-hidden" style={{ background: t.bg, border: `1px solid ${t.border}` }}>
      {/* 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 헤더 */}
        <div className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          {openChat.type === 'dm' && partner
            ? <Avatar p={partner} size={32} />
            : <GroupAvatar name={title} size={32} />
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{title}</p>
            {openChat.type === 'group' && (
              <p className="text-xs" style={{ color: t.muted }}>{groupMembers.length}명</p>
            )}
          </div>
          {openChat.type === 'group' && (
            <button onClick={() => setShowInfo(v => !v)} className="p-1.5 rounded-lg" style={{ background: showInfo ? t.accentLight : 'transparent', color: showInfo ? t.accentText : t.muted }}>
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
            </button>
          )}
          <button onClick={() => onClose(openChat.id)} className="p-1.5 rounded-lg" style={{ color: t.muted }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5" style={{ background: t.bg }}>
          {renderMessages()}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div className="px-3 pb-3 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${t.borderSub}` }}>
          {inputDisabled ? (
            <div className="flex items-center justify-center rounded-2xl px-4 py-3" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
              <p className="text-xs" style={{ color: t.muted }}>
                {roomDeleted ? '방장이 채팅방을 삭제했어요.' : '방장이 나가서 채팅을 할 수 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2 rounded-2xl px-3 py-2" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="메시지 입력..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none"
                style={{ color: t.text, maxHeight: 120, lineHeight: '1.5' }}
              />
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ background: t.accent }}>
                <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 그룹 정보 패널 */}
      {openChat.type === 'group' && showInfo && (
        <div className="w-56 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: `1px solid ${t.border}`, background: t.surface }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
            <p className="font-bold text-sm" style={{ color: t.text }}>{title}</p>
            {openChat.groupRoom?.description && (
              <p className="text-xs mt-0.5" style={{ color: t.muted }}>{openChat.groupRoom.description}</p>
            )}
          </div>

          {/* 오픈방 초대 링크 */}
          {roomType === 'open' && (
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
              <p className="text-xs font-bold mb-2" style={{ color: t.muted }}>초대 링크</p>
              <button onClick={copyInviteLink}
                className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
                style={{ background: copied ? 'rgba(124,58,237,0.15)' : t.inputBg, color: copied ? '#a78bfa' : t.muted, border: `1px solid ${t.border}` }}>
                {copied ? '복사됨!' : '🔗 링크 복사'}
              </button>
              <p className="text-xs mt-1 text-center break-all" style={{ color: t.label, fontSize: 10 }}>코드: {inviteCode}</p>
            </div>
          )}

          {/* 그룹방 친구 초대 */}
          {roomType === 'group' && (
            <div style={{ borderBottom: `1px solid ${t.borderSub}` }}>
              <button onClick={() => setShowInvite(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold"
                style={{ color: t.muted }}>
                <span>친구 초대</span>
                <span>{showInvite ? '▲' : '▼'}</span>
              </button>
              {showInvite && (
                <div className="pb-2">
                  {(friendList ?? []).length === 0
                    ? <p className="text-xs text-center py-3" style={{ color: t.label }}>친구가 없어요</p>
                    : (friendList ?? []).map(f => {
                      const fId = f.requester_id === userId ? f.receiver_id : f.requester_id
                      const fp = pMap[fId]
                      const alreadyIn = groupMembers.some(m => m.user_id === fId)
                      return (
                        <div key={f.id} className="flex items-center gap-2 px-4 py-1.5">
                          <Avatar p={fp} size={24} />
                          <p className="flex-1 text-xs truncate" style={{ color: t.text }}>{fp?.nickname || '...'}</p>
                          <button onClick={() => inviteFriend(fId)} disabled={alreadyIn || invitingId === fId}
                            className="text-xs px-2 py-1 rounded-lg flex-shrink-0 disabled:opacity-40"
                            style={{ background: alreadyIn ? t.inputBg : t.accentLight, color: alreadyIn ? t.muted : t.accentText, fontSize: 10 }}>
                            {invitingId === fId ? '...' : alreadyIn ? '참여중' : '초대'}
                          </button>
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          )}

          {/* 멤버 목록 */}
          <div className="flex-1">
            <p className="px-4 pt-3 pb-1.5 text-xs font-bold" style={{ color: t.muted }}>멤버 {groupMembers.length}명</p>
            {groupMembers.map(m => {
              const isMe = m.user_id === userId
              const isMemberOwner = m.role === 'owner'
              return (
                <div key={m.id} className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                  <Avatar p={gProfiles[m.user_id]} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: t.text }}>{gProfiles[m.user_id]?.nickname || '...'}{isMe ? ' (나)' : ''}</p>
                    {roomType === 'open' && isMemberOwner && <p style={{ color: '#f59e0b', fontSize: 10 }}>👑 방장</p>}
                  </div>
                  {/* 오픈방 방장만 내보내기 가능 */}
                  {roomType === 'open' && isOwner && !isMe && (
                    <button onClick={() => kickMember(m)} disabled={kickingId === m.user_id} title="내보내기"
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      {kickingId === m.user_id
                        ? <span style={{ fontSize: 9 }}>...</span>
                        : <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* 나가기 */}
          <div className="p-4">
            <button onClick={leaveGroup} className="w-full py-2 rounded-xl text-xs font-medium"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>나가기</button>
          </div>
        </div>
      )}
    </div>
  )
}