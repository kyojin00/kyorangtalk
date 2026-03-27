'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null }
interface Message { id: string; room_id: string; sender_id: string; content: string; created_at: string; is_read: boolean }
interface GroupRoom { id: string; name: string; description: string | null; created_by: string; invite_code: string; is_public: boolean; member_count: number }
interface GroupMessage { id: string; room_id: string; sender_id: string; content: string; created_at: string }
interface GroupMember { id: string; room_id: string; user_id: string; role: string }
interface OpenChat { id: string; type: 'dm' | 'group'; room?: Room; groupRoom?: GroupRoom }

const Avatar = ({ p, size = 40 }: { p: Profile | null | undefined; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative', color: 'white' }}>
    {p?.avatar_url ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} /> : <span>{p?.nickname?.[0] || '?'}</span>}
  </div>
)

const GroupAvatar = ({ name, size = 40 }: { name: string; size?: number }) => (
  <div className="rounded-2xl overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', fontSize: size * 0.38, color: 'white' }}>
    {name?.[0] || '?'}
  </div>
)

// 채팅 패널
function ChatPanel({ openChat, userId, pMap, isDark, onClose, onMarkRead }: {
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
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const partner = openChat.type === 'dm' && openChat.room
    ? pMap[openChat.room.user1_id === userId ? openChat.room.user2_id : openChat.room.user1_id]
    : null

  const t = {
    bg: isDark ? '#0f0f14' : '#f7f4ff',
    surface: isDark ? '#1a1a24' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)',
    borderSub: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,92,231,0.06)',
    text: isDark ? '#e2d9f3' : '#2A2035',
    muted: isDark ? '#5a5a6e' : '#9B8FA8',
    accent: '#7c3aed',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.05)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,92,231,0.15)',
    myBubble: isDark ? '#6d28d9' : '#7c3aed',
    theirBubble: isDark ? '#1e1e2e' : '#ffffff',
    theirBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.12)',
    datePill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.07)',
    headerBg: isDark ? '#13131a' : '#f0eeff',
  }

  useEffect(() => {
    if (openChat.type === 'dm') loadDM()
    else loadGroup()
  }, [openChat.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, groupMessages])

  useEffect(() => {
    if (openChat.type !== 'dm') return
    const ch = supabase.channel(`dm:${openChat.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${openChat.id}` },
        async (p) => {
          const msg = p.new as Message
          setMessages(prev => [...prev, msg])
          if (msg.sender_id !== userId) {
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
          setGroupMessages(prev => [...prev, msg])
          if (!gProfiles[msg.sender_id]) {
            const { data } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', msg.sender_id).single()
            if (data) setGProfiles(prev => ({ ...prev, [data.id]: data }))
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
    const { data: members } = await supabase.from('kyorangtalk_group_members').select('*').eq('room_id', openChat.id)
    if (members) {
      setGroupMembers(members)
      const ids = members.map(m => m.user_id)
      const { data: profiles } = await supabase.from('kyorangtalk_profiles').select('*').in('id', ids)
      if (profiles) { const obj: Record<string, Profile> = {}; profiles.forEach(p => { obj[p.id] = p }); setGProfiles(obj) }
    }
    if (!inviteCode) {
      const { data: room } = await supabase.from('kyorangtalk_group_rooms').select('invite_code').eq('id', openChat.id).single()
      if (room) setInviteCode(room.invite_code)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    if (openChat.type === 'dm') {
      await supabase.from('kyorangtalk_messages').insert({ room_id: openChat.id, sender_id: userId, content, is_read: false })
      await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', openChat.id)
    } else {
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: openChat.id, sender_id: userId, content })
    }
    setSending(false)
  }

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const leaveGroup = async () => {
    if (!confirm('그룹에서 나갈까요?')) return
    await supabase.from('kyorangtalk_group_members').delete().eq('room_id', openChat.id).eq('user_id', userId)
    onClose(openChat.id)
  }

  const isSameDay = (a: string, b: string) => { const da = new Date(a), db = new Date(b); return da.toDateString() === db.toDateString() }
  const isSameMin = (a: string, b: string) => { if (!isSameDay(a, b)) return false; const da = new Date(a), db = new Date(b); return da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes() }
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d: string) => { const date = new Date(d), now = new Date(); const diff = new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime(); if (diff === 0) return '오늘'; if (diff === 86400000) return '어제'; return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) }

  const list = openChat.type === 'dm' ? messages : groupMessages

  const renderMessages = () => list.map((msg, i) => {
    const prev = list[i - 1]
    const next = list[i + 1]
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

          <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'} max-w-[70%]`}>
            {/* 읽음/시간 - 버블 옆에 */}
            {isLast && (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0 mb-0.5">
                {isMine && openChat.type === 'dm' && dmMsg && !dmMsg.is_read && (
                  <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, lineHeight: 1 }}>1</span>
                )}
                <span style={{ color: t.muted, fontSize: 10, whiteSpace: 'nowrap' }}>{fmtTime(msg.created_at)}</span>
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
              <p className="text-xs" style={{ color: t.muted, fontSize: 10 }}>{groupMembers.length}명</p>
            )}
          </div>
          {openChat.type === 'group' && (
            <button onClick={() => setShowInfo(p => !p)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
              style={{ background: showInfo ? 'rgba(124,58,237,0.15)' : t.inputBg, color: showInfo ? '#a78bfa' : t.muted }}>👥</button>
          )}
          <button onClick={() => onClose(openChat.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs hover:opacity-60"
            style={{ background: t.inputBg, color: t.muted }}>✕</button>
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

      {/* 그룹 정보 사이드 */}
      {showInfo && openChat.type === 'group' && (
        <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 200, borderLeft: `1px solid ${t.border}`, background: t.surface }}>
          <div className="p-4">
            <p className="text-xs font-bold mb-3" style={{ color: t.muted }}>초대 링크</p>
            <button onClick={copyInviteLink} className="w-full text-xs py-2 rounded-xl font-medium transition-all"
              style={{ background: copied ? 'rgba(124,58,237,0.15)' : t.inputBg, color: copied ? '#a78bfa' : t.muted, border: `1px solid ${t.border}` }}>
              {copied ? '복사됨!' : '🔗 링크 복사'}
            </button>
            <p className="text-xs mt-2 text-center break-all" style={{ color: t.muted, fontSize: 10 }}>
              코드: {inviteCode}
            </p>
          </div>
          <div style={{ borderTop: `1px solid ${t.border}` }}>
            <p className="px-4 pt-3 pb-1.5 text-xs font-bold" style={{ color: t.muted }}>멤버 {groupMembers.length}명</p>
            {groupMembers.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                <Avatar p={gProfiles[m.user_id]} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: t.text }}>{gProfiles[m.user_id]?.nickname || '...'}</p>
                  {m.role === 'owner' && <p className="text-xs" style={{ color: '#f59e0b', fontSize: 10 }}>방장</p>}
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

export default function HomeClient({ userId, profile, friends, pending, rooms, profileMap }: {
  userId: string
  profile: Profile
  friends: Friend[]
  pending: Friend[]
  rooms: Room[]
  profileMap: Record<string, Profile>
}) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'friends' | 'chats' | 'groups' | 'explore' | 'settings'>('friends')
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [friendList, setFriendList] = useState(friends)
  const [pendingList, setPendingList] = useState(pending)
  const [sentList, setSentList] = useState<Friend[]>([])
  const [pMap, setPMap] = useState(profileMap)
  const [roomList, setRoomList] = useState(rooms)
  const [openChats, setOpenChats] = useState<OpenChat[]>([])
  const [myGroupRooms, setMyGroupRooms] = useState<GroupRoom[]>([])
  const [publicRooms, setPublicRooms] = useState<GroupRoom[]>([])
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteResults, setInviteResults] = useState<Profile[]>([])
  const [invitedMembers, setInvitedMembers] = useState<Profile[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joiningCode, setJoiningCode] = useState(false)
  const [exploreSearch, setExploreSearch] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
    loadMyGroups()
    loadSentRequests()
    loadUnreadCounts()
    loadPublicRooms()
  }, [])

  const loadUnreadCounts = async () => {
    const { data } = await supabase.from('kyorangtalk_messages').select('room_id').eq('is_read', false).neq('sender_id', userId)
    if (data) { const c: Record<string, number> = {}; data.forEach(m => { c[m.room_id] = (c[m.room_id] || 0) + 1 }); setUnreadMap(c) }
  }

  const handleMarkRead = (roomId: string) => setUnreadMap(prev => { const n = { ...prev }; delete n[roomId]; return n })

  const loadMyGroups = async () => {
    const { data: memberRows } = await supabase.from('kyorangtalk_group_members').select('room_id').eq('user_id', userId)
    if (!memberRows || memberRows.length === 0) return
    const ids = memberRows.map(m => m.room_id)
    const { data } = await supabase.from('kyorangtalk_group_rooms').select('*').in('id', ids).order('created_at', { ascending: false })
    if (data) setMyGroupRooms(data)
  }

  const loadPublicRooms = async () => {
    const { data } = await supabase.from('kyorangtalk_group_rooms').select('*').eq('is_public', true).order('member_count', { ascending: false }).limit(50)
    if (data) setPublicRooms(data)
  }

  const loadSentRequests = async () => {
    const { data } = await supabase.from('kyorangtalk_friends').select('*').eq('requester_id', userId).eq('status', 'pending')
    if (data) {
      setSentList(data)
      const ids = data.map(f => f.receiver_id)
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('kyorangtalk_profiles').select('*').in('id', ids)
        if (profiles) { const obj: Record<string, Profile> = {}; profiles.forEach(p => { obj[p.id] = p }); setPMap(prev => ({ ...prev, ...obj })) }
      }
    }
  }

  const openDMChat = (room: Room) => {
    if (openChats.find(c => c.id === room.id)) return
    setOpenChats(prev => [...prev, { id: room.id, type: 'dm', room }])
  }

  const openGroupChat = (groupRoom: GroupRoom) => {
    if (openChats.find(c => c.id === groupRoom.id)) return
    setOpenChats(prev => [...prev, { id: groupRoom.id, type: 'group', groupRoom }])
  }

  const closeChat = (id: string) => setOpenChats(prev => prev.filter(c => c.id !== id))

  const joinGroupByCode = async () => {
    if (!joinCode.trim()) return
    setJoiningCode(true)
    const { data: room } = await supabase.from('kyorangtalk_group_rooms').select('*').eq('invite_code', joinCode.trim()).single()
    if (!room) { alert('유효하지 않은 코드예요'); setJoiningCode(false); return }
    const { data: existing } = await supabase.from('kyorangtalk_group_members').select('id').eq('room_id', room.id).eq('user_id', userId).single()
    if (!existing) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'member' })
      await supabase.from('kyorangtalk_group_rooms').update({ member_count: (room.member_count || 1) + 1 }).eq('id', room.id)
      setMyGroupRooms(prev => [room, ...prev])
    }
    setJoinCode('')
    openGroupChat(room)
    setTab('groups')
    setJoiningCode(false)
  }

  const joinPublicRoom = async (room: GroupRoom) => {
    const { data: existing } = await supabase.from('kyorangtalk_group_members').select('id').eq('room_id', room.id).eq('user_id', userId).single()
    if (!existing) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'member' })
      await supabase.from('kyorangtalk_group_rooms').update({ member_count: (room.member_count || 1) + 1 }).eq('id', room.id)
      setMyGroupRooms(prev => [room, ...prev])
    }
    openGroupChat(room)
    setTab('groups')
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setCreatingGroup(true)
    const { data: room } = await supabase
      .from('kyorangtalk_group_rooms')
      .insert({ name: groupName.trim(), description: groupDesc.trim() || null, created_by: userId, is_public: isPublic, member_count: invitedMembers.length + 1 })
      .select().single()
    if (room) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'owner' })
      for (const m of invitedMembers) await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: m.id, role: 'member' })
      setMyGroupRooms(prev => [room, ...prev])
      if (isPublic) setPublicRooms(prev => [room, ...prev])
      setShowCreateGroup(false)
      setGroupName(''); setGroupDesc(''); setInvitedMembers([]); setIsPublic(false)
      openGroupChat(room)
      setTab('groups')
    }
    setCreatingGroup(false)
  }

  const handleInviteSearch = async () => {
    if (!inviteQuery.trim()) return
    const { data } = await supabase.from('kyorangtalk_profiles').select('*').ilike('nickname', `%${inviteQuery}%`).neq('id', userId).limit(10)
    setInviteResults(data || [])
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase.from('kyorangtalk_profiles').select('*').ilike('nickname', `%${searchQuery}%`).neq('id', userId).limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  const sendFriendRequest = async (receiverId: string) => {
    const { data: ex } = await supabase.from('kyorangtalk_friends').select('*').or(`and(requester_id.eq.${userId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${userId})`).limit(1)
    if (ex && ex.length > 0) { alert(ex[0].status === 'accepted' ? '이미 친구예요!' : '이미 요청이 있어요!'); return }
    const { data, error } = await supabase.from('kyorangtalk_friends').insert({ requester_id: userId, receiver_id: receiverId }).select().single()
    if (!error && data) { setSentList(prev => [...prev, data]); setSearchResults([]); alert('친구 요청을 보냈어요!') }
  }

  const cancelFriendRequest = async (id: string) => { await supabase.from('kyorangtalk_friends').delete().eq('id', id); setSentList(prev => prev.filter(f => f.id !== id)) }
  const acceptFriend = async (id: string) => {
    await supabase.from('kyorangtalk_friends').update({ status: 'accepted' }).eq('id', id)
    const acc = pendingList.find(p => p.id === id)
    if (acc) { setFriendList(prev => [...prev, { ...acc, status: 'accepted' }]); setPendingList(prev => prev.filter(p => p.id !== id)) }
  }
  const rejectFriend = async (id: string) => { await supabase.from('kyorangtalk_friends').delete().eq('id', id); setPendingList(prev => prev.filter(p => p.id !== id)) }

  const startChat = async (friendUserId: string) => {
    const u1 = userId < friendUserId ? userId : friendUserId
    const u2 = userId < friendUserId ? friendUserId : userId
    const { data: ex } = await supabase.from('kyorangtalk_rooms').select('*').eq('user1_id', u1).eq('user2_id', u2).single()
    if (ex) { openDMChat(ex); setTab('chats'); return }
    const { data: nr } = await supabase.from('kyorangtalk_rooms').insert({ user1_id: u1, user2_id: u2 }).select().single()
    if (nr) { setRoomList(prev => [nr, ...prev]); openDMChat(nr); setTab('chats') }
  }

  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id
  const getPartner = (r: Room) => pMap[r.user1_id === userId ? r.user2_id : r.user1_id]
  const fmtTime = (d: string) => { const date = new Date(d), now = new Date(); if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }); return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) }
  const toggleTheme = (dark: boolean) => { setIsDark(dark); localStorage.setItem('kyorangtalk-theme', dark ? 'dark' : 'light') }
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)

  const filteredPublic = publicRooms.filter(r => !exploreSearch || r.name.includes(exploreSearch) || r.description?.includes(exploreSearch))
  const joinedIds = new Set(myGroupRooms.map(r => r.id))

  const t = {
    bg: isDark ? '#0f0f14' : '#f7f4ff',
    surface: isDark ? '#1a1a24' : '#ffffff',
    sidebarBg: isDark ? '#13131a' : '#f0eeff',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)',
    borderSub: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,92,231,0.06)',
    text: isDark ? '#e2d9f3' : '#2A2035',
    muted: isDark ? '#5a5a6e' : '#9B8FA8',
    label: isDark ? '#4a4a5e' : '#c4b8d4',
    accent: '#7c3aed',
    accentLight: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)',
    accentText: isDark ? '#a78bfa' : '#7c3aed',
    accentBorder: isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.05)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,92,231,0.15)',
  }

  const tabs = [
    { key: 'friends' as const, icon: '👥', badge: pendingList.length },
    { key: 'chats' as const, icon: '💬', badge: totalUnread },
    { key: 'groups' as const, icon: '🏠', badge: 0 },
    { key: 'explore' as const, icon: '🔍', badge: 0 },
    { key: 'settings' as const, icon: '⚙️', badge: 0 },
  ]

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: t.bg }}>

      {/* 그룹 만들기 모달 */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="rounded-3xl p-6 w-full max-w-md mx-4 overflow-y-auto" style={{ background: t.surface, maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold" style={{ color: t.text }}>새 그룹 만들기</h3>
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc(''); setIsPublic(false) }} style={{ color: t.muted }}>✕</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="그룹 이름 *" value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              <textarea placeholder="그룹 설명 (선택)" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} rows={2}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />

              {/* 공개 여부 */}
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: t.text }}>공개 그룹</p>
                  <p className="text-xs" style={{ color: t.muted }}>탐색에서 발견 가능</p>
                </div>
                <button onClick={() => setIsPublic(p => !p)}
                  className="w-11 h-6 rounded-full transition-all relative"
                  style={{ background: isPublic ? t.accent : t.inputBorder }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: isPublic ? '22px' : '2px' }} />
                </button>
              </div>

              {/* 멤버 초대 */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: t.muted }}>멤버 초대 (선택)</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="닉네임 검색" value={inviteQuery} onChange={e => setInviteQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleInviteSearch()}
                    className="flex-1 text-sm rounded-xl px-4 py-2.5 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
                  <button onClick={handleInviteSearch} className="text-sm px-4 py-2.5 rounded-xl text-white" style={{ background: t.accent }}>검색</button>
                </div>
                {inviteResults.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                    {inviteResults.map((r, i) => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2" style={{ background: t.surface, borderTop: i > 0 ? `1px solid ${t.borderSub}` : 'none' }}>
                        <div className="flex items-center gap-2"><Avatar p={r} size={30} /><p className="text-sm" style={{ color: t.text }}>{r.nickname}</p></div>
                        {invitedMembers.find(m => m.id === r.id)
                          ? <button onClick={() => setInvitedMembers(prev => prev.filter(m => m.id !== r.id))} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.accentLight, color: t.accentText }}>취소</button>
                          : <button onClick={() => setInvitedMembers(prev => [...prev, r])} className="text-xs px-2.5 py-1 rounded-full text-white" style={{ background: t.accent }}>초대</button>}
                      </div>
                    ))}
                  </div>
                )}
                {invitedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {invitedMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs" style={{ background: t.accentLight, color: t.accentText }}>
                        {m.nickname}<button onClick={() => setInvitedMembers(prev => prev.filter(x => x.id !== m.id))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || creatingGroup} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: t.accent }}>
                {creatingGroup ? '만드는 중...' : '만들기'}
              </button>
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc(''); setIsPublic(false) }}
                className="px-5 py-3 rounded-xl text-sm" style={{ background: t.inputBg, color: t.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 아이콘 사이드바 */}
      <div className="flex flex-col items-center py-6 gap-3 flex-shrink-0" style={{ width: 68, background: t.sidebarBg, borderRight: `1px solid ${t.border}` }}>
        <div className="mb-2"><Avatar p={profile} size={34} /></div>
        {tabs.map(({ key, icon, badge }) => (
          <button key={key} onClick={() => setTab(key)} className="relative w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all"
            style={{ background: tab === key ? t.accentLight : 'transparent' }}>
            {icon}
            {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{badge}</span>}
          </button>
        ))}
        <div className="mt-auto">
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-60">🚪</button>
        </div>
      </div>

      {/* 목록 패널 */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 280, borderRight: `1px solid ${t.border}`, background: t.surface }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: t.text }}>
            {tab === 'friends' ? '친구' : tab === 'chats' ? '채팅' : tab === 'groups' ? '그룹' : tab === 'explore' ? '탐색' : '설정'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">

          {/* 친구 탭 */}
          {tab === 'friends' && (
            <div>
              <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-3 px-4 py-4 text-left hover:opacity-70" style={{ borderBottom: `1px solid ${t.border}` }}>
                <Avatar p={profile} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: t.text }}>{profile.nickname}</p>
                  <p className="text-xs truncate" style={{ color: t.muted }}>{profile.status_message || '상태 메시지 설정'}</p>
                </div>
                <span style={{ color: t.muted }}>✏️</span>
              </button>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="닉네임 검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="text-sm outline-none flex-1" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, borderRadius: 10, padding: '8px 12px' }} />
                  <button onClick={handleSearch} disabled={searching} className="text-sm font-medium flex-shrink-0"
                    style={{ background: t.accent, color: 'white', borderRadius: 10, padding: '8px 12px' }}>{searching ? '...' : '검색'}</button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                    {searchResults.map((r, i) => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5" style={{ background: t.surface, borderTop: i > 0 ? `1px solid ${t.borderSub}` : 'none' }}>
                        <div className="flex items-center gap-2"><Avatar p={r} size={32} /><p className="text-sm" style={{ color: t.text }}>{r.nickname}</p></div>
                        <button onClick={() => sendFriendRequest(r.id)} className="text-xs px-3 py-1 rounded-full font-medium" style={{ background: t.accentLight, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>추가</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {pendingList.length > 0 && (<div>
                <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>받은 요청 {pendingList.length}</p>
                {pendingList.map(req => (
                  <div key={req.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                    <div className="flex items-center gap-2.5"><Avatar p={pMap[req.requester_id]} size={36} />
                      <div><p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.requester_id]?.nickname || '알 수 없음'}</p><p className="text-xs" style={{ color: t.muted }}>친구 요청</p></div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => acceptFriend(req.id)} className="text-xs px-2.5 py-1 rounded-full text-white" style={{ background: t.accent }}>수락</button>
                      <button onClick={() => rejectFriend(req.id)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.inputBg, color: t.muted }}>거절</button>
                    </div>
                  </div>
                ))}
              </div>)}
              {sentList.length > 0 && (<div>
                <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>보낸 요청 {sentList.length}</p>
                {sentList.map(req => (
                  <div key={req.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                    <div className="flex items-center gap-2.5"><Avatar p={pMap[req.receiver_id]} size={36} />
                      <div><p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.receiver_id]?.nickname || '알 수 없음'}</p><p className="text-xs" style={{ color: t.muted }}>대기 중</p></div>
                    </div>
                    <button onClick={() => cancelFriendRequest(req.id)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.inputBg, color: t.muted }}>취소</button>
                  </div>
                ))}
              </div>)}
              {friendList.length > 0 && (<div>
                <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>친구 {friendList.length}명</p>
                {friendList.map(f => {
                  const fId = getFriendUserId(f); const fp = pMap[fId]
                  return (
                    <div key={f.id} className="flex items-center justify-between px-4 py-2.5 hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <div className="flex items-center gap-2.5"><Avatar p={fp} size={36} />
                        <div><p className="text-sm font-medium" style={{ color: t.text }}>{fp?.nickname || '알 수 없음'}</p>{fp?.status_message && <p className="text-xs truncate" style={{ color: t.muted }}>{fp.status_message}</p>}</div>
                      </div>
                      <button onClick={() => startChat(fId)} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: t.accentLight, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>채팅</button>
                    </div>
                  )
                })}
              </div>)}
              {friendList.length === 0 && pendingList.length === 0 && sentList.length === 0 && (
                <div className="text-center py-16"><p className="text-3xl mb-3">🐱</p><p className="text-sm" style={{ color: t.muted }}>아직 친구가 없어요</p></div>
              )}
            </div>
          )}

          {/* 채팅 탭 */}
          {tab === 'chats' && (
            <div>
              {roomList.length === 0
                ? <div className="text-center py-16"><p className="text-3xl mb-3">💬</p><p className="text-sm" style={{ color: t.muted }}>채팅이 없어요</p></div>
                : roomList.map(room => {
                  const partner = getPartner(room); const unread = unreadMap[room.id] || 0; const isOpen = !!openChats.find(c => c.id === room.id)
                  return (
                    <button key={room.id} onClick={() => openDMChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70"
                      style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                      <div className="relative"><Avatar p={partner} size={42} />
                        {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{unread}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="font-semibold text-sm" style={{ color: t.text }}>{partner?.nickname || '알 수 없음'}</span>
                          {room.last_message_at && <span className="text-xs" style={{ color: t.muted }}>{fmtTime(room.last_message_at)}</span>}
                        </div>
                        <p className="text-xs truncate" style={{ color: t.muted, fontWeight: unread > 0 ? 600 : 400 }}>{room.last_message || '대화를 시작해보세요'}</p>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          )}

          {/* 그룹 탭 */}
          {tab === 'groups' && (
            <div>
              <div className="px-4 py-3 space-y-2" style={{ borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setShowCreateGroup(true)} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>+ 새 그룹 만들기</button>
                {/* 코드로 참여 */}
                <div className="flex gap-2">
                  <input type="text" placeholder="초대 코드 입력" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && joinGroupByCode()}
                    className="flex-1 text-sm rounded-xl px-3 py-2 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
                  <button onClick={joinGroupByCode} disabled={!joinCode.trim() || joiningCode}
                    className="text-xs px-3 py-2 rounded-xl font-medium text-white disabled:opacity-50" style={{ background: t.accent }}>참여</button>
                </div>
              </div>
              {myGroupRooms.length === 0
                ? <div className="text-center py-16"><p className="text-3xl mb-3">🏠</p><p className="text-sm" style={{ color: t.muted }}>그룹이 없어요</p></div>
                : myGroupRooms.map(room => {
                  const isOpen = !!openChats.find(c => c.id === room.id)
                  return (
                    <button key={room.id} onClick={() => openGroupChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70"
                      style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                      <GroupAvatar name={room.name} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                          {room.is_public && <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: t.accentLight, color: t.accentText, fontSize: 10 }}>공개</span>}
                        </div>
                        <p className="text-xs" style={{ color: t.muted }}>{room.member_count}명 · {room.description || '그룹 채팅방'}</p>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          )}

          {/* 탐색 탭 */}
          {tab === 'explore' && (
            <div>
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <input type="text" placeholder="그룹 검색..." value={exploreSearch} onChange={e => setExploreSearch(e.target.value)}
                  className="w-full text-sm rounded-xl px-4 py-2.5 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              </div>
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold" style={{ color: t.label }}>공개 그룹 {filteredPublic.length}개</p>
              {filteredPublic.length === 0
                ? <div className="text-center py-12"><p className="text-3xl mb-3">🔍</p><p className="text-sm" style={{ color: t.muted }}>공개 그룹이 없어요</p></div>
                : filteredPublic.map(room => {
                  const alreadyJoined = joinedIds.has(room.id)
                  return (
                    <div key={room.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <GroupAvatar name={room.name} size={42} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                        <p className="text-xs" style={{ color: t.muted }}>{room.member_count}명 · {room.description || '공개 그룹'}</p>
                      </div>
                      <button onClick={() => joinPublicRoom(room)}
                        className="text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0"
                        style={alreadyJoined
                          ? { background: t.accentLight, color: t.accentText }
                          : { background: t.accent, color: 'white' }}>
                        {alreadyJoined ? '입장' : '참여'}
                      </button>
                    </div>
                  )
                })
              }
            </div>
          )}

          {/* 설정 탭 */}
          {tab === 'settings' && (
            <div className="p-4 space-y-3">
              <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left hover:opacity-70"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <Avatar p={profile} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: t.text }}>{profile.nickname}</p>
                  <p className="text-xs truncate" style={{ color: t.muted }}>{profile.status_message || '상태 메시지 없음'}</p>
                </div>
                <span style={{ color: t.muted }}>✏️</span>
              </button>
              <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label, borderBottom: `1px solid ${t.borderSub}` }}>테마</p>
                <div className="flex">
                  <button onClick={() => toggleTheme(false)} className="flex-1 flex items-center justify-center gap-2 py-3" style={{ background: !isDark ? t.accentLight : 'transparent', borderRight: `1px solid ${t.borderSub}` }}>
                    <span>☀️</span><span className="text-sm" style={{ color: !isDark ? t.accentText : t.muted }}>라이트</span>
                  </button>
                  <button onClick={() => toggleTheme(true)} className="flex-1 flex items-center justify-center gap-2 py-3" style={{ background: isDark ? t.accentLight : 'transparent' }}>
                    <span>🌙</span><span className="text-sm" style={{ color: isDark ? t.accentText : t.muted }}>다크</span>
                  </button>
                </div>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                className="w-full py-3.5 rounded-2xl text-sm font-medium" style={{ background: t.surface, color: '#ef4444', border: `1px solid ${t.border}` }}>로그아웃</button>
            </div>
          )}
        </div>
      </div>

      {/* 멀티 채팅 패널 */}
      <div className="flex-1 flex gap-3 p-3 overflow-x-auto" style={{ background: t.bg }}>
        {openChats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-5xl">🐱</p>
            <p className="font-medium text-sm" style={{ color: t.muted }}>대화를 선택해보세요</p>
            <p className="text-xs" style={{ color: t.label }}>여러 채팅을 동시에 열 수 있어요</p>
          </div>
        ) : openChats.map(chat => (
          <div key={chat.id} style={{ width: `${Math.max(300, Math.floor(100 / openChats.length))}%`, minWidth: '300px', maxWidth: '600px', flexShrink: 0, flexGrow: 1 }}>
            <ChatPanel openChat={chat} userId={userId} pMap={pMap} isDark={isDark} onClose={closeChat} onMarkRead={handleMarkRead} />
          </div>
        ))}
      </div>
    </div>
  )
}