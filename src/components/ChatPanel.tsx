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
  const [presenceIds, setPresenceIds] = useState<Set<string>>(new Set())
  const presenceIdsRef = useRef<Set<string>>(new Set())
  // { user_id: last_read_at } — 오프라인 멤버 읽음 시각 (presence 없는 경우 fallback)
  const [readMap, setReadMap] = useState<Record<string, string>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const groupSubRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const [uploading, setUploading] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderNick: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number; isMine: boolean; content: string } | null>(null)
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

    const sub = supabase.channel(`dm-${roomId}`, { config: { presence: { key: userId } } })

    sub
      .on('presence', { event: 'sync' }, () => {
        const state = sub.presenceState<{ user_id: string }>()
        const ids = new Set(Object.values(state).flatMap(s => s.map((p: any) => p.user_id)))
        presenceIdsRef.current = ids
        setPresenceIds(new Set(ids))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${roomId}` }, payload => {
        setMessages(prev => [...prev, payload.new as Message])
        if ((payload.new as Message).sender_id !== userId) {
          supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('id', payload.new.id)
          onMarkRead(roomId)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${roomId}` }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...(payload.new as Message) } : m))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await sub.track({ user_id: userId })
      })

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

      // 내 읽음 처리
      const now = new Date().toISOString()
      await supabase.from('kyorangtalk_group_reads')
        .upsert({ room_id: roomId, user_id: userId, last_read_at: now }, { onConflict: 'room_id,user_id' })
      setReadMap(prev => ({ ...prev, [userId]: now }))
      onMarkRead(roomId)
    }
    loadGroup()

    const sub = supabase.channel(`group-${roomId}`, { config: { presence: { key: userId } } })
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
      .on('presence', { event: 'sync' }, () => {
        const state = sub.presenceState<{ user_id: string }>()
        const ids = new Set(Object.values(state).flatMap(s => s.map((p: any) => p.user_id)))
        presenceIdsRef.current = ids
        setPresenceIds(new Set(ids))
      })
      .on('presence', { event: 'join' }, async ({ newPresences }) => {
        // 상대방 입장 → DB에서 실제 last_read_at 로드
        const joinedIds = (newPresences as any[]).map((p: any) => p.user_id).filter((id: string) => id !== userId)
        if (!joinedIds.length) return
        const { data: reads } = await supabase
          .from('kyorangtalk_group_reads')
          .select('user_id, last_read_at')
          .eq('room_id', roomId)
          .in('user_id', joinedIds)
        if (reads) setReadMap(prev => {
          const next = { ...prev }
          reads.forEach(r => { next[r.user_id] = r.last_read_at })
          return next
        })
      })
      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
        // 상대방 퇴장 → DB에서 최신 last_read_at 다시 로드해서 readMap 갱신
        const leftIds = (leftPresences as any[]).map((p: any) => p.user_id).filter((id: string) => id !== userId)
        if (!leftIds.length) return
        const { data: reads } = await supabase
          .from('kyorangtalk_group_reads')
          .select('user_id, last_read_at')
          .eq('room_id', roomId)
          .in('user_id', leftIds)
        if (reads) setReadMap(prev => {
          const next = { ...prev }
          reads.forEach(r => { next[r.user_id] = r.last_read_at })
          return next
        })
      })
      .subscribe(async status => {
        console.log(`[그룹 Realtime ${roomId}]`, status)
        if (status === 'SUBSCRIBED') await sub.track({ user_id: userId })
      })

    return () => { supabase.removeChannel(sub) }
  }, [openChat.id])

  // 스크롤 하단 감지
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAtBottom(isBottom)
  }

  // 새 메시지 오면 하단에 있을 때만 자동 스크롤
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, groupMessages])

  // DM 전송
  const sendDm = async () => {
    if (!input.trim() || !openChat.room || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    const now = new Date().toISOString()
    const insertData: any = { room_id: openChat.room!.id, sender_id: userId, content }
    if (replyTo) { insertData.reply_to_id = replyTo.id; insertData.reply_to_content = replyTo.content }
    setReplyTo(null)
    await supabase.from('kyorangtalk_messages').insert(insertData)
    await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: now }).eq('id', openChat.room.id)
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
    const insertData: any = { room_id: openChat.groupRoom!.id, sender_id: userId, content, msg_type: 'message' }
    if (replyTo) { insertData.reply_to_id = replyTo.id; insertData.reply_to_content = replyTo.content }
    setReplyTo(null)
    const tempMsg: GroupMessage = { id: tempId, room_id: openChat.groupRoom.id, sender_id: userId, content, created_at: now, msg_type: 'message' } as any
    setGroupMessages(prev => [...prev, tempMsg])
    const { data, error } = await supabase.from('kyorangtalk_group_messages').insert(insertData).select().single()
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

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능해요'); return }
    if (file.size > 5 * 1024 * 1024) { alert('5MB 이하 이미지만 업로드 가능해요'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-images').upload(path, file)
    if (error) { alert('업로드 실패'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path)
    const now = new Date().toISOString()

    if (openChat.type === 'dm' && openChat.room) {
      const roomId = openChat.room.id
      await supabase.from('kyorangtalk_messages').insert({ room_id: roomId, sender_id: userId, content: '', image_url: publicUrl })
      await supabase.from('kyorangtalk_rooms').update({ last_message: '📷 이미지', last_message_at: now }).eq('id', roomId)
      // broadcast → 상대방 목록 + 알림
      await supabase.channel(`room-update-${roomId}`).send({
        type: 'broadcast', event: 'new_message',
        payload: { room_id: roomId, content: '📷 이미지', created_at: now, sender_id: userId, type: 'dm' }
      })
      onMessageSent(roomId, '📷 이미지', 'dm')
    } else if (openChat.groupRoom) {
      const roomId = openChat.groupRoom.id
      const { data } = await supabase.from('kyorangtalk_group_messages')
        .insert({ room_id: roomId, sender_id: userId, content: '', image_url: publicUrl, msg_type: 'message' })
        .select().single()
      if (data) {
        // 채팅창 broadcast
        await groupSubRef.current?.send({ type: 'broadcast', event: 'new_message', payload: data })
        // 목록 + 알림 broadcast
        await supabase.channel(`room-update-${roomId}`).send({
          type: 'broadcast', event: 'new_message',
          payload: { room_id: roomId, content: '📷 이미지', created_at: now, sender_id: userId, type: 'group' }
        })
        onMessageSent(roomId, '📷 이미지', 'group')
      }
    }
    setUploading(false)
  }

  // 그룹 나가기
  const leaveGroup = async () => {
    if (!openChat.groupRoom) return
    const roomId = openChat.groupRoom.id
    const myNick = gProfiles[userId]?.nickname || '누군가'

    // 나가기 전 읽음 시각 기록
    await supabase.from('kyorangtalk_group_reads')
      .upsert({ room_id: roomId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: 'room_id,user_id' })

    if (roomType === 'open' && isOwner) {
      // 오픈방 방장 나가기 → 방 유지
      if (!confirm('오픈방을 나가시겠어요?\n방은 유지되지만 채팅이 비활성화됩니다.')) return
      await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${myNick}님(방장)이 나갔어요. 채팅이 비활성화됩니다.`, msg_type: 'system' })
      await groupSubRef.current?.send({ type: 'broadcast', event: 'owner_left', payload: {} })
      // 남은 멤버 없으면 방 삭제
      const { count } = await supabase.from('kyorangtalk_group_members').select('id', { count: 'exact', head: true }).eq('room_id', roomId)
      if (count === 0) await supabase.from('kyorangtalk_group_rooms').delete().eq('id', roomId)
    } else if (roomType === 'open') {
      // 오픈방 일반 멤버
      if (!confirm('채팅방을 나가시겠어요?')) return
      await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: roomId, sender_id: userId, content: `${myNick}님이 나갔어요.`, msg_type: 'system' })
      // 남은 멤버 없으면 방 삭제
      const { count } = await supabase.from('kyorangtalk_group_members').select('id', { count: 'exact', head: true }).eq('room_id', roomId)
      if (count === 0) await supabase.from('kyorangtalk_group_rooms').delete().eq('id', roomId)
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

  // 메시지 삭제
  const deleteMessage = async (msgId: string) => {
    setContextMenu(null)
    if (openChat.type === 'dm') {
      await supabase.from('kyorangtalk_messages').delete().eq('id', msgId).eq('sender_id', userId)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    } else {
      await supabase.from('kyorangtalk_group_messages').delete().eq('id', msgId).eq('sender_id', userId)
      setGroupMessages(prev => prev.filter(m => m.id !== msgId))
    }
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

      // 그룹방 안읽은 멤버 수 (시스템 메시지 제외, 모든 메시지에 표시)
      let unreadCount: number | null = null
      if (openChat.type === 'group' && !isSystem) {
        const otherMembers = groupMembers.filter(m => m.user_id !== msg.sender_id)
        const unreadMembers = otherMembers.filter(m => {
          if (presenceIdsRef.current.has(m.user_id)) return false
          const lastRead = readMap[m.user_id]
          return !lastRead || lastRead < msg.created_at
        })
        unreadCount = unreadMembers.length
      }

      // DM 안읽음: presence에 있거나 readMap에 읽은 기록 있으면 읽음
      const partnerId = openChat.type === 'dm' && openChat.room
        ? (openChat.room.user1_id === userId ? openChat.room.user2_id : openChat.room.user1_id)
        : ''
      const dmUnread = openChat.type === 'dm' && isMine && (() => {
        if (presenceIdsRef.current.has(partnerId)) return false
        const lastRead = readMap[partnerId]
        if (lastRead && lastRead >= msg.created_at) return false
        return !(msg as Message).is_read
      })()

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
                  <div
                    className="rounded-2xl text-sm break-words"
                    style={{
                      background: isMine ? t.accent : t.surface,
                      color: isMine ? '#fff' : t.text,
                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onContextMenu={e => { e.preventDefault(); setContextMenu({ msgId: msg.id, x: e.clientX, y: e.clientY, isMine, content: msg.content }) }}
                    onTouchStart={e => {
                      const t2 = setTimeout(() => setContextMenu({ msgId: msg.id, x: e.touches[0].clientX, y: e.touches[0].clientY, isMine, content: msg.content }), 500)
                      const cancel = () => { clearTimeout(t2); document.removeEventListener('touchend', cancel) }
                      document.addEventListener('touchend', cancel)
                    }}
                  >
                    {/* 답장 인용 표시 */}
                    {(msg as any).reply_to_content && (
                      <div className="px-3 pt-2 pb-1" style={{ borderBottom: `1px solid ${isMine ? 'rgba(255,255,255,0.2)' : t.borderSub}` }}>
                        <div className="flex items-start gap-1.5">
                          <div className="w-1 rounded-full flex-shrink-0 self-stretch" style={{ background: isMine ? 'rgba(255,255,255,0.6)' : t.accent, minHeight: 12 }} />
                          <p className="text-xs opacity-70 line-clamp-2" style={{ color: isMine ? '#fff' : t.muted }}>
                            {(msg as any).reply_to_content}
                          </p>
                        </div>
                      </div>
                    )}
                    <div style={{ padding: (msg as any).image_url && !msg.content ? '4px' : '8px 12px' }}>
                      {(msg as any).image_url && (
                        <img src={(msg as any).image_url} alt="이미지"
                          className="rounded-xl cursor-pointer max-w-full"
                          style={{ maxWidth: 220, maxHeight: 220, display: 'block', objectFit: 'cover' }}
                          onClick={() => window.open((msg as any).image_url, '_blank')} />
                      )}
                      {msg.content && <span>{msg.content}</span>}
                    </div>
                  </div>
                  <div className={`flex flex-col gap-0.5 flex-shrink-0 ${isMine ? 'items-end' : 'items-start'}`}>
                    {unreadCount !== null && unreadCount > 0 && (
                      <span style={{ color: '#f59e0b', fontSize: 10, fontWeight: 600, lineHeight: 1 }}>{unreadCount}</span>
                    )}
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
    <div className="flex h-full rounded-2xl overflow-hidden" style={{ background: t.bg, border: `1px solid ${t.border}` }}
      onClick={() => contextMenu && setContextMenu(null)}>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && (
        <div className="fixed z-50 rounded-2xl overflow-hidden shadow-xl"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 160), top: Math.min(contextMenu.y, window.innerHeight - 120), background: t.surface, border: `1px solid ${t.border}`, minWidth: 140 }}
          onClick={e => e.stopPropagation()}>
          <button onClick={() => {
            const senderNick = contextMenu.isMine ? '나' : (partner?.nickname ?? gProfiles[contextMenu.msgId]?.nickname ?? '상대')
            setReplyTo({ id: contextMenu.msgId, content: contextMenu.content, senderNick })
            setContextMenu(null)
            inputRef.current?.focus()
          }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:opacity-70" style={{ color: t.text, borderBottom: `1px solid ${t.borderSub}` }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
            답장
          </button>
          {contextMenu.isMine && (
            <button onClick={() => deleteMessage(contextMenu.msgId)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:opacity-70" style={{ color: '#ef4444' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              삭제
            </button>
          )}
        </div>
      )}
      {/* 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0 relative">
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
        <div ref={scrollRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5 relative" style={{ background: t.bg }}>
          {renderMessages()}
          <div ref={bottomRef} />
        </div>

        {/* 스크롤 하단 버튼 */}
        {!atBottom && (
          <div className="absolute bottom-20 right-6 z-10">
            <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setAtBottom(true) }}
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: t.accent, color: 'white' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
        )}

        {/* 입력창 */}
        <div className="px-3 pb-3 pt-2 flex-shrink-0" style={{ borderTop: `1px solid ${t.borderSub}` }}>
          {/* 답장 미리보기 */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl" style={{ background: t.inputBg, border: `1px solid ${t.accentBorder}` }}>
              <div className="w-1 h-full rounded-full flex-shrink-0 self-stretch" style={{ background: t.accent, minHeight: 16 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-0.5" style={{ color: t.accentText }}>답장</p>
                <p className="text-xs truncate" style={{ color: t.muted }}>{replyTo.content || '이미지'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} style={{ color: t.muted, flexShrink: 0 }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          )}
          {inputDisabled ? (
            <div className="flex items-center justify-center rounded-2xl px-4 py-3" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
              <p className="text-xs" style={{ color: t.muted }}>
                {roomDeleted ? '방장이 채팅방을 삭제했어요.' : '방장이 나가서 채팅을 할 수 없습니다.'}
              </p>
            </div>
          ) : (
            <div className="flex items-end gap-2 rounded-2xl px-3 py-2" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
              {/* 이미지 업로드 버튼 */}
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 disabled:opacity-30"
                style={{ color: t.muted }}>
                {uploading
                  ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="animate-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                  : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
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