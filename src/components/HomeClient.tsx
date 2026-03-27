'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null; unread_count?: number }
interface Message { id: string; room_id: string; sender_id: string; content: string; created_at: string; is_read: boolean }
interface GroupRoom { id: string; name: string; description: string | null; avatar_url: string | null; created_by: string; created_at: string }
interface GroupMessage { id: string; room_id: string; sender_id: string; content: string; created_at: string }
interface GroupMember { id: string; room_id: string; user_id: string; role: string }

interface OpenChat {
  id: string
  type: 'dm' | 'group'
  room?: Room
  groupRoom?: GroupRoom
}

const Avatar = ({ p, size = 40 }: { p: Profile | null | undefined; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative', color: 'white' }}>
    {p?.avatar_url ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} /> : <span>{p?.nickname?.[0] || '?'}</span>}
  </div>
)

const GroupAvatar = ({ name, size = 40 }: { name: string; size?: number }) => (
  <div className="rounded-2xl overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', fontSize: size * 0.38, color: 'white' }}>
    {name[0]}
  </div>
)

// 개별 채팅 패널 컴포넌트
function ChatPanel({ openChat, userId, pMap, groupMemberProfiles, isDark, onClose, onMarkRead }: {
  openChat: OpenChat
  userId: string
  pMap: Record<string, Profile>
  groupMemberProfiles: Record<string, Profile>
  isDark: boolean
  onClose: (id: string) => void
  onMarkRead: (roomId: string) => void
}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [gProfiles, setGProfiles] = useState(groupMemberProfiles)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  const partner = openChat.type === 'dm' && openChat.room
    ? pMap[openChat.room.user1_id === userId ? openChat.room.user2_id : openChat.room.user1_id]
    : null

  useEffect(() => {
    if (openChat.type === 'dm') loadDMMessages()
    else loadGroupMessages()
  }, [openChat.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, groupMessages])

  useEffect(() => {
    if (openChat.type !== 'dm') return
    const channel = supabase.channel(`room:${openChat.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${openChat.id}` },
        async (payload) => {
          const msg = payload.new as Message
          setMessages(prev => [...prev, msg])
          // 상대방 메시지면 즉시 읽음 처리
          if (msg.sender_id !== userId) {
            await supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('id', msg.id)
            onMarkRead(openChat.id)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${openChat.id}` },
        (payload) => {
          const updated = payload.new as Message
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [openChat.id, openChat.type])

  useEffect(() => {
    if (openChat.type !== 'group') return
    const channel = supabase.channel(`group:${openChat.id}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_group_messages', filter: `room_id=eq.${openChat.id}` },
        async (payload) => {
          const msg = payload.new as GroupMessage
          setGroupMessages(prev => [...prev, msg])
          if (!gProfiles[msg.sender_id]) {
            const { data } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', msg.sender_id).single()
            if (data) setGProfiles(prev => ({ ...prev, [data.id]: data }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [openChat.id, openChat.type])

  const loadDMMessages = async () => {
    const { data } = await supabase.from('kyorangtalk_messages').select('*').eq('room_id', openChat.id).order('created_at', { ascending: true })
    setMessages(data || [])
    // 읽음 처리
    await supabase.from('kyorangtalk_messages').update({ is_read: true }).eq('room_id', openChat.id).neq('sender_id', userId).eq('is_read', false)
    onMarkRead(openChat.id)
  }

  const loadGroupMessages = async () => {
    const { data: msgs } = await supabase.from('kyorangtalk_group_messages').select('*').eq('room_id', openChat.id).order('created_at', { ascending: true })
    setGroupMessages(msgs || [])
    const { data: members } = await supabase.from('kyorangtalk_group_members').select('*').eq('room_id', openChat.id)
    if (members) {
      const ids = members.map(m => m.user_id)
      const { data: profiles } = await supabase.from('kyorangtalk_profiles').select('*').in('id', ids)
      if (profiles) {
        const obj: Record<string, Profile> = {}
        profiles.forEach(p => { obj[p.id] = p })
        setGProfiles(prev => ({ ...prev, ...obj }))
      }
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

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  }

  const isSameMinute = (a: string, b: string) => {
    if (!isSameDay(a, b)) return false
    const da = new Date(a), db = new Date(b)
    return da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes()
  }

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (d: string) => {
    const date = new Date(d), now = new Date()
    const diff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    if (diff === 0) return '오늘'
    if (diff === 86400000) return '어제'
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  const renderMessages = () => {
    const list = openChat.type === 'dm' ? messages : groupMessages
    return list.map((msg, i) => {
      const prev = list[i - 1]
      const next = list[i + 1]
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      const isMine = msg.sender_id === userId
      const isFirst = !prev || prev.sender_id !== msg.sender_id || !isSameMinute(prev.created_at, msg.created_at)
      const isLast = !next || next.sender_id !== msg.sender_id || !isSameMinute(msg.created_at, next.created_at)
      const senderProfile = openChat.type === 'group' ? gProfiles[msg.sender_id] : partner
      const dmMsg = openChat.type === 'dm' ? msg as Message : null

      return (
        <div key={msg.id}>
          {showDate && (
            <div className="flex items-center justify-center my-4">
              <span className="text-xs px-3 py-1 rounded-full" style={{ background: t.datePill, color: t.muted }}>{formatDate(msg.created_at)}</span>
            </div>
          )}
          <div className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirst ? 'mt-0.5' : 'mt-3'}`}>
            {!isMine && (
              <div style={{ width: 26, flexShrink: 0 }}>
                {isLast && <Avatar p={senderProfile} size={26} />}
              </div>
            )}
            <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
              {!isMine && isFirst && <p className="text-xs mb-1 px-1" style={{ color: t.muted }}>{senderProfile?.nickname || '알 수 없음'}</p>}
              <div className="px-3.5 py-2 text-sm leading-relaxed"
                style={{
                  background: isMine ? t.myBubble : t.theirBubble,
                  color: isMine ? 'white' : t.text,
                  border: isMine ? 'none' : `1px solid ${t.theirBorder}`,
                  borderRadius: isMine
                    ? `16px 16px ${isLast ? '4px' : '16px'} 16px`
                    : `16px 16px 16px ${isLast ? '4px' : '16px'}`,
                }}>
                {msg.content}
              </div>
              {isLast && (
                <div className="flex items-center gap-1 mt-0.5 px-1">
                  <span style={{ color: t.muted, fontSize: 10 }}>{formatTime(msg.created_at)}</span>
                  {/* 읽음 표시 - DM만 */}
                  {isMine && openChat.type === 'dm' && dmMsg && (
                    <span style={{ fontSize: 10, color: dmMsg.is_read ? '#a78bfa' : t.muted }}>
                      {dmMsg.is_read ? '읽음' : '전송'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-2xl" style={{ background: t.bg, border: `1px solid ${t.border}`, minWidth: '300px' }}>
      {/* 헤더 */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 h-12" style={{ background: t.headerBg, borderBottom: `1px solid ${t.border}` }}>
        {openChat.type === 'dm'
          ? <Avatar p={partner} size={28} />
          : <GroupAvatar name={openChat.groupRoom?.name ?? ''} size={28} />
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs truncate" style={{ color: t.text }}>
            {openChat.type === 'dm' ? partner?.nickname : openChat.groupRoom?.name}
          </p>
          {openChat.type === 'dm' && partner?.status_message && (
            <p className="text-xs truncate" style={{ color: t.muted, fontSize: 10 }}>{partner.status_message}</p>
          )}
        </div>
        <button onClick={() => onClose(openChat.id)} className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 hover:opacity-60" style={{ background: t.inputBg, color: t.muted }}>✕</button>
      </div>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ background: t.bg }}>
        {renderMessages()}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="flex-shrink-0 flex gap-2 items-end px-3 py-3" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="메시지..."
          rows={1}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, maxHeight: '100px' }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || sending}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30 text-xs"
          style={{ background: input.trim() ? t.accent : t.muted }}>↑</button>
      </div>
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
  const [tab, setTab] = useState<'friends' | 'chats' | 'groups' | 'settings'>('friends')
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
  const [groupRooms, setGroupRooms] = useState<GroupRoom[]>([])
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({})
  const [groupMemberProfiles, setGroupMemberProfiles] = useState<Record<string, Profile>>({})
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [groupInviteQuery, setGroupInviteQuery] = useState('')
  const [groupInviteResults, setGroupInviteResults] = useState<Profile[]>([])
  const [invitedMembers, setInvitedMembers] = useState<Profile[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})

  useEffect(() => {
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
    loadGroupRooms()
    loadSentRequests()
    loadUnreadCounts()
  }, [])

  const loadUnreadCounts = async () => {
    const { data } = await supabase
      .from('kyorangtalk_messages')
      .select('room_id')
      .eq('is_read', false)
      .neq('sender_id', userId)
    if (data) {
      const counts: Record<string, number> = {}
      data.forEach(m => { counts[m.room_id] = (counts[m.room_id] || 0) + 1 })
      setUnreadMap(counts)
    }
  }

  const handleMarkRead = (roomId: string) => {
    setUnreadMap(prev => { const n = { ...prev }; delete n[roomId]; return n })
  }

  const loadGroupRooms = async () => {
    const { data: memberRows } = await supabase.from('kyorangtalk_group_members').select('room_id').eq('user_id', userId)
    if (!memberRows || memberRows.length === 0) return
    const roomIds = memberRows.map(m => m.room_id)
    const { data: rooms } = await supabase.from('kyorangtalk_group_rooms').select('*').in('id', roomIds).order('created_at', { ascending: false })
    if (rooms) setGroupRooms(rooms)
  }

  const loadSentRequests = async () => {
    const { data } = await supabase.from('kyorangtalk_friends').select('*').eq('requester_id', userId).eq('status', 'pending')
    if (data) {
      setSentList(data)
      const ids = data.map(f => f.receiver_id)
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('kyorangtalk_profiles').select('*').in('id', ids)
        if (profiles) {
          const obj: Record<string, Profile> = {}
          profiles.forEach(p => { obj[p.id] = p })
          setPMap(prev => ({ ...prev, ...obj }))
        }
      }
    }
  }

  const openDMChat = async (room: Room) => {
    if (openChats.find(c => c.id === room.id)) return
    setOpenChats(prev => [...prev, { id: room.id, type: 'dm', room }])
  }

  const openGroupChat = async (groupRoom: GroupRoom) => {
    if (openChats.find(c => c.id === groupRoom.id)) return
    setOpenChats(prev => [...prev, { id: groupRoom.id, type: 'group', groupRoom }])
  }

  const closeChat = (id: string) => {
    setOpenChats(prev => prev.filter(c => c.id !== id))
  }

  const startChat = async (friendUserId: string) => {
    const user1_id = userId < friendUserId ? userId : friendUserId
    const user2_id = userId < friendUserId ? friendUserId : userId
    const { data: existing } = await supabase.from('kyorangtalk_rooms').select('*').eq('user1_id', user1_id).eq('user2_id', user2_id).single()
    if (existing) { openDMChat(existing); setTab('chats'); return }
    const { data: newRoom } = await supabase.from('kyorangtalk_rooms').insert({ user1_id, user2_id }).select().single()
    if (newRoom) { setRoomList(prev => [newRoom, ...prev]); openDMChat(newRoom); setTab('chats') }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase.from('kyorangtalk_profiles').select('*').ilike('nickname', `%${searchQuery}%`).neq('id', userId).limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  const sendFriendRequest = async (receiverId: string) => {
    const { data: existing } = await supabase.from('kyorangtalk_friends').select('*')
      .or(`and(requester_id.eq.${userId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${userId})`).limit(1)
    if (existing && existing.length > 0) { alert(existing[0].status === 'accepted' ? '이미 친구예요!' : '이미 친구 요청이 있어요!'); return }
    const { data, error } = await supabase.from('kyorangtalk_friends').insert({ requester_id: userId, receiver_id: receiverId }).select().single()
    if (error) alert('오류가 발생했어요.')
    else { if (data) setSentList(prev => [...prev, data]); setSearchResults([]); alert('친구 요청을 보냈어요!') }
  }

  const cancelFriendRequest = async (friendId: string) => {
    await supabase.from('kyorangtalk_friends').delete().eq('id', friendId)
    setSentList(prev => prev.filter(f => f.id !== friendId))
  }

  const acceptFriend = async (friendId: string) => {
    const { error } = await supabase.from('kyorangtalk_friends').update({ status: 'accepted' }).eq('id', friendId)
    if (!error) {
      const accepted = pendingList.find(p => p.id === friendId)
      if (accepted) {
        setFriendList(prev => [...prev, { ...accepted, status: 'accepted' }])
        setPendingList(prev => prev.filter(p => p.id !== friendId))
        const { data: p } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', accepted.requester_id).single()
        if (p) setPMap(prev => ({ ...prev, [p.id]: p }))
      }
    }
  }

  const rejectFriend = async (friendId: string) => {
    await supabase.from('kyorangtalk_friends').delete().eq('id', friendId)
    setPendingList(prev => prev.filter(p => p.id !== friendId))
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setCreatingGroup(true)
    const { data: room } = await supabase.from('kyorangtalk_group_rooms').insert({ name: groupName.trim(), description: groupDesc.trim() || null, created_by: userId }).select().single()
    if (room) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'owner' })
      for (const member of invitedMembers) {
        await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: member.id, role: 'member' })
      }
      setGroupRooms(prev => [room, ...prev])
      setShowCreateGroup(false)
      setGroupName(''); setGroupDesc(''); setInvitedMembers([])
      openGroupChat(room)
    }
    setCreatingGroup(false)
  }

  const handleGroupInviteSearch = async () => {
    if (!groupInviteQuery.trim()) return
    const { data } = await supabase.from('kyorangtalk_profiles').select('*').ilike('nickname', `%${groupInviteQuery}%`).neq('id', userId).limit(10)
    setGroupInviteResults(data || [])
  }

  const leaveGroup = async (roomId: string) => {
    if (!confirm('그룹에서 나갈까요?')) return
    await supabase.from('kyorangtalk_group_members').delete().eq('room_id', roomId).eq('user_id', userId)
    setGroupRooms(prev => prev.filter(r => r.id !== roomId))
    closeChat(roomId)
  }

  const toggleTheme = (dark: boolean) => { setIsDark(dark); localStorage.setItem('kyorangtalk-theme', dark ? 'dark' : 'light') }
  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id
  const getPartner = (room: Room) => pMap[room.user1_id === userId ? room.user2_id : room.user1_id]
  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)

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
    headerBg: isDark ? '#13131a' : '#f0eeff',
  }

  const tabs = [
    { key: 'friends' as const, label: '친구', icon: '👥', badge: pendingList.length },
    { key: 'chats' as const, label: '채팅', icon: '💬', badge: totalUnread },
    { key: 'groups' as const, label: '그룹', icon: '🏠', badge: 0 },
    { key: 'settings' as const, label: '설정', icon: '⚙️', badge: 0 },
  ]

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr), now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: t.bg }}>

      {/* 그룹 만들기 모달 */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-3xl p-6 w-full max-w-md mx-4" style={{ background: t.surface }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: t.text }}>새 그룹 만들기</h3>
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc('') }} style={{ color: t.muted }}>✕</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="그룹 이름 *" value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              <input type="text" placeholder="그룹 설명 (선택)" value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: t.muted }}>멤버 초대</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="닉네임 검색" value={groupInviteQuery} onChange={e => setGroupInviteQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGroupInviteSearch()}
                    className="flex-1 text-sm rounded-xl px-4 py-2.5 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
                  <button onClick={handleGroupInviteSearch} className="text-sm px-4 py-2.5 rounded-xl text-white" style={{ background: t.accent }}>검색</button>
                </div>
                {groupInviteResults.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                    {groupInviteResults.map((r, i) => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5" style={{ background: t.surface, borderTop: i > 0 ? `1px solid ${t.borderSub}` : 'none' }}>
                        <div className="flex items-center gap-2"><Avatar p={r} size={32} /><p className="text-sm" style={{ color: t.text }}>{r.nickname}</p></div>
                        {invitedMembers.find(m => m.id === r.id)
                          ? <button onClick={() => setInvitedMembers(prev => prev.filter(m => m.id !== r.id))} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.accentLight, color: t.accentText }}>취소</button>
                          : <button onClick={() => setInvitedMembers(prev => [...prev, r])} className="text-xs px-2.5 py-1 rounded-full text-white" style={{ background: t.accent }}>초대</button>
                        }
                      </div>
                    ))}
                  </div>
                )}
                {invitedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {invitedMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs" style={{ background: t.accentLight, color: t.accentText }}>
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
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc('') }} className="px-5 py-3 rounded-xl text-sm" style={{ background: t.inputBg, color: t.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 아이콘 사이드바 */}
      <div className="flex flex-col items-center py-6 gap-3 flex-shrink-0" style={{ width: 68, background: t.sidebarBg, borderRight: `1px solid ${t.border}` }}>
        <div className="mb-2"><Avatar p={profile} size={34} /></div>
        {tabs.map(({ key, icon, badge }) => (
          <button key={key} onClick={() => setTab(key)} className="relative w-10 h-10 rounded-xl flex items-center justify-center text-base transition-all" style={{ background: tab === key ? t.accentLight : 'transparent' }}>
            {icon}
            {badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{badge}</span>}
          </button>
        ))}
        <div className="mt-auto">
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-opacity hover:opacity-60">🚪</button>
        </div>
      </div>

      {/* 목록 패널 */}
      <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 280, borderRight: `1px solid ${t.border}`, background: t.surface }}>
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h2 className="font-bold text-sm" style={{ color: t.text }}>
            {tab === 'friends' ? '친구' : tab === 'chats' ? '채팅' : tab === 'groups' ? '그룹' : '설정'}
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
                <span style={{ color: t.muted, fontSize: 12 }}>✏️</span>
              </button>

              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <div className="flex gap-2">
                  <input type="text" placeholder="닉네임 검색" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    className="text-sm outline-none flex-1"
                    style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, borderRadius: 10, padding: '8px 12px' }} />
                  <button onClick={handleSearch} disabled={searching} className="text-sm font-medium flex-shrink-0"
                    style={{ background: t.accent, color: 'white', borderRadius: 10, padding: '8px 12px' }}>
                    {searching ? '...' : '검색'}
                  </button>
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

              {pendingList.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>받은 요청 {pendingList.length}</p>
                  {pendingList.map(req => (
                    <div key={req.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <div className="flex items-center gap-2.5">
                        <Avatar p={pMap[req.requester_id]} size={36} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.requester_id]?.nickname || '알 수 없음'}</p>
                          <p className="text-xs" style={{ color: t.muted }}>친구 요청</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => acceptFriend(req.id)} className="text-xs px-2.5 py-1 rounded-full text-white" style={{ background: t.accent }}>수락</button>
                        <button onClick={() => rejectFriend(req.id)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.inputBg, color: t.muted }}>거절</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sentList.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>보낸 요청 {sentList.length}</p>
                  {sentList.map(req => (
                    <div key={req.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <div className="flex items-center gap-2.5">
                        <Avatar p={pMap[req.receiver_id]} size={36} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.receiver_id]?.nickname || '알 수 없음'}</p>
                          <p className="text-xs" style={{ color: t.muted }}>수락 대기 중</p>
                        </div>
                      </div>
                      <button onClick={() => cancelFriendRequest(req.id)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: t.inputBg, color: t.muted }}>취소</button>
                    </div>
                  ))}
                </div>
              )}

              {friendList.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>친구 {friendList.length}명</p>
                  {friendList.map(f => {
                    const fId = getFriendUserId(f)
                    const fp = pMap[fId]
                    return (
                      <div key={f.id} className="flex items-center justify-between px-4 py-2.5 hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                        <div className="flex items-center gap-2.5">
                          <Avatar p={fp} size={36} />
                          <div>
                            <p className="text-sm font-medium" style={{ color: t.text }}>{fp?.nickname || '알 수 없음'}</p>
                            {fp?.status_message && <p className="text-xs truncate" style={{ color: t.muted }}>{fp.status_message}</p>}
                          </div>
                        </div>
                        <button onClick={() => startChat(fId)} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: t.accentLight, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>채팅</button>
                      </div>
                    )
                  })}
                </div>
              )}

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
                  const partner = getPartner(room)
                  const unread = unreadMap[room.id] || 0
                  const isOpen = openChats.find(c => c.id === room.id)
                  return (
                    <button key={room.id} onClick={() => openDMChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                      <div className="relative">
                        <Avatar p={partner} size={42} />
                        {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{unread}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="font-semibold text-sm" style={{ color: t.text }}>{partner?.nickname || '알 수 없음'}</span>
                          {room.last_message_at && <span className="text-xs" style={{ color: t.muted }}>{formatTime(room.last_message_at)}</span>}
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
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setShowCreateGroup(true)} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>+ 새 그룹</button>
              </div>
              {groupRooms.length === 0
                ? <div className="text-center py-16"><p className="text-3xl mb-3">🏠</p><p className="text-sm" style={{ color: t.muted }}>그룹이 없어요</p></div>
                : groupRooms.map(room => {
                  const isOpen = openChats.find(c => c.id === room.id)
                  return (
                    <button key={room.id} onClick={() => openGroupChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                      <GroupAvatar name={room.name} size={42} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                        <p className="text-xs truncate" style={{ color: t.muted }}>{room.description || '그룹 채팅방'}</p>
                      </div>
                    </button>
                  )
                })
              }
            </div>
          )}

          {/* 설정 탭 */}
          {tab === 'settings' && (
            <div className="p-4 space-y-3">
              <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left hover:opacity-70" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
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
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} className="w-full py-3.5 rounded-2xl text-sm font-medium" style={{ background: t.surface, color: '#ef4444', border: `1px solid ${t.border}` }}>로그아웃</button>
            </div>
          )}
        </div>
      </div>

      {/* 멀티 채팅 패널 영역 */}
      <div className="flex-1 flex gap-3 p-3 overflow-x-auto" style={{ background: t.bg }}>
        {openChats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-5xl">🐱</p>
            <p className="font-medium text-sm" style={{ color: t.muted }}>대화를 선택해보세요</p>
            <p className="text-xs" style={{ color: t.label }}>여러 채팅을 동시에 열 수 있어요</p>
          </div>
        ) : (
          openChats.map(chat => (
            <div key={chat.id} style={{ width: `${Math.max(300, Math.floor(100 / openChats.length))}%`, minWidth: '300px', maxWidth: '600px', flexShrink: 0, flexGrow: 1 }}>
              <ChatPanel
                openChat={chat}
                userId={userId}
                pMap={pMap}
                groupMemberProfiles={groupMemberProfiles}
                isDark={isDark}
                onClose={closeChat}
                onMarkRead={handleMarkRead}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}