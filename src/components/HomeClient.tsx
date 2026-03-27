'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null; updated_at: string }
interface Message { id: string; room_id: string; sender_id: string; content: string; created_at: string }
interface GroupRoom { id: string; name: string; description: string | null; avatar_url: string | null; created_by: string; created_at: string }
interface GroupMessage { id: string; room_id: string; sender_id: string; content: string; created_at: string }
interface GroupMember { id: string; room_id: string; user_id: string; role: string }

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
  const [pMap, setPMap] = useState(profileMap)
  const [roomList, setRoomList] = useState(rooms)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [activeRoomType, setActiveRoomType] = useState<'dm' | 'group'>('dm')
  const [activeMessages, setActiveMessages] = useState<Message[]>([])
  const [activeGroupMessages, setActiveGroupMessages] = useState<GroupMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showPartnerProfile, setShowPartnerProfile] = useState(false)

  // 그룹채팅 상태
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
  const [activeGroupRoom, setActiveGroupRoom] = useState<GroupRoom | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
    loadGroupRooms()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, activeGroupMessages])

  // DM 실시간
  useEffect(() => {
    if (!activeRoomId || activeRoomType !== 'dm') return
    const channel = supabase.channel(`room:${activeRoomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${activeRoomId}` },
        (payload) => setActiveMessages(prev => [...prev, payload.new as Message]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeRoomId, activeRoomType])

  // 그룹 실시간
  useEffect(() => {
    if (!activeRoomId || activeRoomType !== 'group') return
    const channel = supabase.channel(`group:${activeRoomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_group_messages', filter: `room_id=eq.${activeRoomId}` },
        async (payload) => {
          const msg = payload.new as GroupMessage
          setActiveGroupMessages(prev => [...prev, msg])
          if (!groupMemberProfiles[msg.sender_id]) {
            const { data } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', msg.sender_id).single()
            if (data) setGroupMemberProfiles(prev => ({ ...prev, [data.id]: data }))
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeRoomId, activeRoomType])

  const loadGroupRooms = async () => {
    const { data: memberRows } = await supabase
      .from('kyorangtalk_group_members')
      .select('room_id')
      .eq('user_id', userId)

    if (!memberRows || memberRows.length === 0) return

    const roomIds = memberRows.map(m => m.room_id)
    const { data: rooms } = await supabase
      .from('kyorangtalk_group_rooms')
      .select('*')
      .in('id', roomIds)
      .order('created_at', { ascending: false })

    if (rooms) setGroupRooms(rooms)
  }

  const openGroupRoom = async (room: GroupRoom) => {
    setActiveRoomId(room.id)
    setActiveRoomType('group')
    setActiveGroupRoom(room)
    setShowGroupInfo(false)

    const { data: msgs } = await supabase
      .from('kyorangtalk_group_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
    setActiveGroupMessages(msgs || [])

    const { data: members } = await supabase
      .from('kyorangtalk_group_members')
      .select('*')
      .eq('room_id', room.id)
    if (members) {
      setGroupMembers(prev => ({ ...prev, [room.id]: members }))
      const memberIds = members.map(m => m.user_id)
      const { data: profiles } = await supabase
        .from('kyorangtalk_profiles')
        .select('*')
        .in('id', memberIds)
      if (profiles) {
        const profileObj: Record<string, Profile> = {}
        profiles.forEach(p => { profileObj[p.id] = p })
        setGroupMemberProfiles(prev => ({ ...prev, ...profileObj }))
      }
    }
  }

  const openRoom = async (roomId: string) => {
    setActiveRoomId(roomId)
    setActiveRoomType('dm')
    setActiveGroupRoom(null)
    setShowPartnerProfile(false)
    const { data } = await supabase.from('kyorangtalk_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true })
    setActiveMessages(data || [])
    setTab('chats')
  }

  const sendMessage = async () => {
    if (!chatInput.trim() || chatSending || !activeRoomId) return
    setChatSending(true)
    const content = chatInput.trim()
    setChatInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    if (activeRoomType === 'dm') {
      const { error } = await supabase.from('kyorangtalk_messages').insert({ room_id: activeRoomId, sender_id: userId, content })
      if (!error) {
        await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', activeRoomId)
        setRoomList(prev => prev.map(r => r.id === activeRoomId ? { ...r, last_message: content, last_message_at: new Date().toISOString() } : r))
      }
    } else {
      await supabase.from('kyorangtalk_group_messages').insert({ room_id: activeRoomId, sender_id: userId, content })
    }
    setChatSending(false)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return
    setCreatingGroup(true)

    const { data: room } = await supabase
      .from('kyorangtalk_group_rooms')
      .insert({ name: groupName.trim(), description: groupDesc.trim() || null, created_by: userId })
      .select().single()

    if (room) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'owner' })
      for (const member of invitedMembers) {
        await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: member.id, role: 'member' })
      }
      setGroupRooms(prev => [room, ...prev])
      setShowCreateGroup(false)
      setGroupName('')
      setGroupDesc('')
      setInvitedMembers([])
      openGroupRoom(room)
      setTab('groups')
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
    if (activeRoomId === roomId) { setActiveRoomId(null); setActiveGroupRoom(null) }
  }

  const toggleTheme = (dark: boolean) => { setIsDark(dark); localStorage.setItem('kyorangtalk-theme', dark ? 'dark' : 'light') }
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

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
    const { error } = await supabase.from('kyorangtalk_friends').insert({ requester_id: userId, receiver_id: receiverId })
    if (error) alert('오류가 발생했어요.')
    else { alert('친구 요청을 보냈어요!'); setSearchResults([]) }
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

  const startChat = async (friendUserId: string) => {
    const user1_id = userId < friendUserId ? userId : friendUserId
    const user2_id = userId < friendUserId ? friendUserId : userId
    const { data: existing } = await supabase.from('kyorangtalk_rooms').select('*').eq('user1_id', user1_id).eq('user2_id', user2_id).single()
    if (existing) { openRoom(existing.id); setTab('chats'); return }
    const { data: newRoom } = await supabase.from('kyorangtalk_rooms').insert({ user1_id, user2_id }).select().single()
    if (newRoom) { setRoomList(prev => [newRoom, ...prev]); openRoom(newRoom.id); setTab('chats') }
  }

  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id
  const getPartner = (room: Room) => pMap[room.user1_id === userId ? room.user2_id : room.user1_id]

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr), now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const y = new Date(); y.setDate(now.getDate() - 1)
    if (d.toDateString() === y.toDateString()) return '어제'
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

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
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes()
  }

  const isSameDay = (a: string, b: string) => {
    const da = new Date(a), db = new Date(b)
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  }

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
    tabActive: isDark ? '#a78bfa' : '#7c3aed',
    tabInactive: isDark ? '#5a5a6e' : '#9B8FA8',
    myBubble: isDark ? '#6d28d9' : '#7c3aed',
    theirBubble: isDark ? '#1e1e2e' : '#ffffff',
    theirBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.12)',
    datePill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.07)',
    headerBg: isDark ? 'rgba(15,15,20,0.95)' : 'rgba(247,244,255,0.95)',
  }

  const tabs = [
    { key: 'friends' as const, label: '친구', icon: '👥', badge: pendingList.length },
    { key: 'chats' as const, label: '채팅', icon: '💬', badge: 0 },
    { key: 'groups' as const, label: '그룹', icon: '🏠', badge: 0 },
    { key: 'settings' as const, label: '설정', icon: '⚙️', badge: 0 },
  ]

  const renderDMMessages = () => {
    const elements: React.ReactNode[] = []
    activeMessages.forEach((msg, i) => {
      const prev = activeMessages[i - 1]
      const next = activeMessages[i + 1]
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      if (showDate) {
        elements.push(
          <div key={`date-${msg.id}`} className="flex items-center justify-center my-6">
            <span className="text-xs px-4 py-1.5 rounded-full" style={{ background: t.datePill, color: t.muted }}>{formatDate(msg.created_at)}</span>
          </div>
        )
      }
      const isMine = msg.sender_id === userId
      const isLastInGroup = !next || !isSameMinute(msg.created_at, next.created_at) || next.sender_id !== msg.sender_id
      const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameMinute(prev.created_at, msg.created_at)
      elements.push(
        <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirstInGroup ? 'mt-0.5' : 'mt-3'}`}>
          {!isMine && (
            <div style={{ width: 28, flexShrink: 0 }}>
              {isLastInGroup && <button onClick={() => setShowPartnerProfile(true)}><Avatar p={activePartner} size={28} /></button>}
            </div>
          )}
          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[68%]`}>
            {!isMine && isFirstInGroup && <p className="text-xs mb-1 px-1" style={{ color: t.muted }}>{activePartner?.nickname}</p>}
            <div className="px-4 py-2.5 text-sm leading-relaxed"
              style={{
                background: isMine ? t.myBubble : t.theirBubble,
                color: isMine ? 'white' : t.text,
                border: isMine ? 'none' : `1px solid ${t.theirBorder}`,
                borderRadius: isMine ? `18px 18px ${isLastInGroup ? '4px' : '18px'} 18px` : `18px 18px 18px ${isLastInGroup ? '4px' : '18px'}`,
              }}>
              {msg.content}
            </div>
            {isLastInGroup && <span className="text-xs mt-1 px-1" style={{ color: t.muted, fontSize: 11 }}>{formatTime(msg.created_at)}</span>}
          </div>
        </div>
      )
    })
    return elements
  }

  const renderGroupMessages = () => {
    const elements: React.ReactNode[] = []
    activeGroupMessages.forEach((msg, i) => {
      const prev = activeGroupMessages[i - 1]
      const next = activeGroupMessages[i + 1]
      const showDate = !prev || !isSameDay(prev.created_at, msg.created_at)
      if (showDate) {
        elements.push(
          <div key={`date-${msg.id}`} className="flex items-center justify-center my-6">
            <span className="text-xs px-4 py-1.5 rounded-full" style={{ background: t.datePill, color: t.muted }}>{formatDate(msg.created_at)}</span>
          </div>
        )
      }
      const isMine = msg.sender_id === userId
      const senderProfile = groupMemberProfiles[msg.sender_id]
      const isLastInGroup = !next || !isSameMinute(msg.created_at, next.created_at) || next.sender_id !== msg.sender_id
      const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || !isSameMinute(prev.created_at, msg.created_at)
      elements.push(
        <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'} ${!isFirstInGroup ? 'mt-0.5' : 'mt-3'}`}>
          {!isMine && (
            <div style={{ width: 28, flexShrink: 0 }}>
              {isLastInGroup && <Avatar p={senderProfile} size={28} />}
            </div>
          )}
          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[68%]`}>
            {!isMine && isFirstInGroup && <p className="text-xs mb-1 px-1" style={{ color: t.muted }}>{senderProfile?.nickname || '알 수 없음'}</p>}
            <div className="px-4 py-2.5 text-sm leading-relaxed"
              style={{
                background: isMine ? t.myBubble : t.theirBubble,
                color: isMine ? 'white' : t.text,
                border: isMine ? 'none' : `1px solid ${t.theirBorder}`,
                borderRadius: isMine ? `18px 18px ${isLastInGroup ? '4px' : '18px'} 18px` : `18px 18px 18px ${isLastInGroup ? '4px' : '18px'}`,
              }}>
              {msg.content}
            </div>
            {isLastInGroup && <span className="text-xs mt-1 px-1" style={{ color: t.muted, fontSize: 11 }}>{formatTime(msg.created_at)}</span>}
          </div>
        </div>
      )
    })
    return elements
  }

  const FriendsContent = () => (
    <div>
      <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-4 px-5 py-5 transition-opacity hover:opacity-70 text-left" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="relative">
          <Avatar p={profile} size={52} />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full" style={{ background: '#22c55e', border: `2px solid ${t.surface}` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: t.text }}>{profile.nickname}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: t.muted }}>{profile.status_message || '상태 메시지를 설정해보세요'}</p>
        </div>
        <span className="text-xs" style={{ color: t.muted }}>✏️</span>
      </button>

      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="닉네임으로 친구 찾기" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="text-sm outline-none"
            style={{ flex: 1, minWidth: 0, background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, borderRadius: 12, padding: '10px 16px' }} />
          <button onClick={handleSearch} disabled={searching}
            className="text-sm font-medium transition-opacity hover:opacity-80 flex-shrink-0"
            style={{ background: t.accent, color: 'white', borderRadius: 12, padding: '10px 16px' }}>
            {searching ? '...' : '검색'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
            {searchResults.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3" style={{ background: t.surface, borderTop: i > 0 ? `1px solid ${t.borderSub}` : 'none' }}>
                <div className="flex items-center gap-3">
                  <Avatar p={r} size={36} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: t.text }}>{r.nickname}</p>
                    {r.status_message && <p className="text-xs" style={{ color: t.muted }}>{r.status_message}</p>}
                  </div>
                </div>
                <button onClick={() => sendFriendRequest(r.id)} className="text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0" style={{ background: t.accentLight, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>추가</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingList.length > 0 && (
        <div>
          <p className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wider uppercase" style={{ color: t.label }}>받은 친구 요청</p>
          {pendingList.map((req) => (
            <div key={req.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
              <div className="flex items-center gap-3">
                <Avatar p={pMap[req.requester_id]} size={40} />
                <p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.requester_id]?.nickname || '알 수 없음'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => acceptFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full font-medium text-white flex-shrink-0" style={{ background: t.accent }}>수락</button>
                <button onClick={() => rejectFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: t.inputBg, color: t.muted }}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {friendList.length > 0 && (
        <div>
          <p className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wider uppercase" style={{ color: t.label }}>친구 {friendList.length}명</p>
          {friendList.map((f) => {
            const fId = getFriendUserId(f)
            const fp = pMap[fId]
            return (
              <div key={f.id} className="flex items-center justify-between px-5 py-3 transition-opacity hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                <div className="flex items-center gap-3">
                  <Avatar p={fp} size={40} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: t.text }}>{fp?.nickname || '알 수 없음'}</p>
                    {fp?.status_message && <p className="text-xs mt-0.5" style={{ color: t.muted }}>{fp.status_message}</p>}
                  </div>
                </div>
                <button onClick={() => startChat(fId)} className="text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0" style={{ background: t.accentLight, color: t.accentText, border: `1px solid ${t.accentBorder}` }}>채팅</button>
              </div>
            )
          })}
        </div>
      )}

      {friendList.length === 0 && pendingList.length === 0 && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🐱</p>
          <p className="text-sm" style={{ color: t.muted }}>아직 친구가 없어요<br />닉네임으로 검색해보세요</p>
        </div>
      )}
    </div>
  )

  const ChatsContent = ({ onRoomClick }: { onRoomClick: (id: string) => void }) => (
    <div>
      {roomList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">💬</p>
          <p className="text-sm" style={{ color: t.muted }}>아직 채팅이 없어요<br />친구 탭에서 채팅을 시작해보세요</p>
        </div>
      ) : (
        roomList.map((room) => {
          const partner = getPartner(room)
          const isActive = room.id === activeRoomId && activeRoomType === 'dm'
          return (
            <button key={room.id} onClick={() => onRoomClick(room.id)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-opacity hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}`, background: isActive ? t.accentLight : 'transparent' }}>
              <Avatar p={partner} size={46} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: t.text }}>{partner?.nickname || '알 수 없음'}</span>
                  {room.last_message_at && <span className="text-xs flex-shrink-0 ml-2" style={{ color: t.muted }}>{formatTime(room.last_message_at)}</span>}
                </div>
                <p className="text-xs truncate" style={{ color: t.muted }}>{room.last_message || '대화를 시작해보세요'}</p>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  const GroupsContent = ({ onGroupClick }: { onGroupClick: (room: GroupRoom) => void }) => (
    <div>
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
        <button onClick={() => setShowCreateGroup(true)}
          className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
          style={{ background: t.accent }}>
          + 새 그룹 만들기
        </button>
      </div>

      {groupRooms.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🏠</p>
          <p className="text-sm" style={{ color: t.muted }}>아직 그룹이 없어요<br />새 그룹을 만들어보세요</p>
        </div>
      ) : (
        groupRooms.map((room) => {
          const isActive = room.id === activeRoomId && activeRoomType === 'group'
          const memberCount = groupMembers[room.id]?.length ?? '...'
          return (
            <button key={room.id} onClick={() => onGroupClick(room)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-opacity hover:opacity-70" style={{ borderBottom: `1px solid ${t.borderSub}`, background: isActive ? t.accentLight : 'transparent' }}>
              <GroupAvatar name={room.name} size={46} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: t.text }}>{room.name}</span>
                  <span className="text-xs flex-shrink-0 ml-2" style={{ color: t.muted }}>{memberCount}명</span>
                </div>
                <p className="text-xs truncate" style={{ color: t.muted }}>{room.description || '그룹 채팅방'}</p>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  const SettingsContent = () => (
    <div className="p-5 space-y-4">
      <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-opacity hover:opacity-70" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <Avatar p={profile} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: t.text }}>{profile.nickname}</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: t.muted }}>{profile.status_message || '상태 메시지 없음'}</p>
        </div>
        <span className="text-xs" style={{ color: t.muted }}>✏️</span>
      </button>
      <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <p className="px-4 py-3 text-xs font-semibold tracking-wider uppercase" style={{ color: t.label, borderBottom: `1px solid ${t.borderSub}` }}>테마</p>
        <div className="flex">
          <button onClick={() => toggleTheme(false)} className="flex-1 flex items-center justify-center gap-2 py-4" style={{ background: !isDark ? t.accentLight : 'transparent', borderRight: `1px solid ${t.borderSub}` }}>
            <span>☀️</span><span className="text-sm font-medium" style={{ color: !isDark ? t.accentText : t.muted }}>라이트</span>
            {!isDark && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />}
          </button>
          <button onClick={() => toggleTheme(true)} className="flex-1 flex items-center justify-center gap-2 py-4" style={{ background: isDark ? t.accentLight : 'transparent' }}>
            <span>🌙</span><span className="text-sm font-medium" style={{ color: isDark ? t.accentText : t.muted }}>다크</span>
            {isDark && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.accent }} />}
          </button>
        </div>
      </div>
      <button onClick={handleLogout} className="w-full py-4 rounded-2xl text-sm font-medium" style={{ background: t.surface, color: '#ef4444', border: `1px solid ${t.border}` }}>로그아웃</button>
    </div>
  )

  const activeRoom = roomList.find(r => r.id === activeRoomId)
  const activePartner = activeRoom ? getPartner(activeRoom) : null
  const currentGroupMembers = activeGroupRoom ? (groupMembers[activeGroupRoom.id] ?? []) : []

  const ChatInput = () => (
    <div className="flex-shrink-0 flex gap-3 items-end px-6 py-4" style={{ background: t.surface, borderTop: `1px solid ${t.border}` }}>
      <textarea
        ref={textareaRef}
        value={chatInput}
        onChange={(e) => { setChatInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        placeholder="메시지를 입력하세요..."
        rows={1}
        className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none"
        style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text, maxHeight: '120px' }}
      />
      <button onClick={sendMessage} disabled={!chatInput.trim() || chatSending}
        className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30"
        style={{ background: chatInput.trim() ? t.accent : t.muted }}>↑</button>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>

      {/* 그룹 만들기 모달 */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-3xl p-6 w-full max-w-md mx-4" style={{ background: t.surface }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: t.text }}>새 그룹 만들기</h3>
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc('') }}
                className="text-sm" style={{ color: t.muted }}>✕</button>
            </div>

            <div className="space-y-3">
              <input type="text" placeholder="그룹 이름 *" value={groupName} onChange={e => setGroupName(e.target.value)}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none"
                style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              <input type="text" placeholder="그룹 설명 (선택)" value={groupDesc} onChange={e => setGroupDesc(e.target.value)}
                className="w-full text-sm rounded-xl px-4 py-3 outline-none"
                style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />

              {/* 멤버 초대 */}
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: t.muted }}>멤버 초대</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="닉네임 검색" value={groupInviteQuery} onChange={e => setGroupInviteQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGroupInviteSearch()}
                    className="flex-1 text-sm rounded-xl px-4 py-2.5 outline-none"
                    style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
                  <button onClick={handleGroupInviteSearch}
                    className="text-sm px-4 py-2.5 rounded-xl text-white"
                    style={{ background: t.accent }}>검색</button>
                </div>

                {groupInviteResults.length > 0 && (
                  <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                    {groupInviteResults.map((r, i) => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2.5"
                        style={{ background: t.surface, borderTop: i > 0 ? `1px solid ${t.borderSub}` : 'none' }}>
                        <div className="flex items-center gap-2">
                          <Avatar p={r} size={32} />
                          <p className="text-sm" style={{ color: t.text }}>{r.nickname}</p>
                        </div>
                        {invitedMembers.find(m => m.id === r.id) ? (
                          <button onClick={() => setInvitedMembers(prev => prev.filter(m => m.id !== r.id))}
                            className="text-xs px-2.5 py-1 rounded-full"
                            style={{ background: t.accentLight, color: t.accentText }}>취소</button>
                        ) : (
                          <button onClick={() => setInvitedMembers(prev => [...prev, r])}
                            className="text-xs px-2.5 py-1 rounded-full text-white"
                            style={{ background: t.accent }}>초대</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {invitedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {invitedMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
                        style={{ background: t.accentLight, color: t.accentText }}>
                        {m.nickname}
                        <button onClick={() => setInvitedMembers(prev => prev.filter(x => x.id !== m.id))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateGroup} disabled={!groupName.trim() || creatingGroup}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: t.accent }}>
                {creatingGroup ? '만드는 중...' : '만들기'}
              </button>
              <button onClick={() => { setShowCreateGroup(false); setInvitedMembers([]); setGroupName(''); setGroupDesc('') }}
                className="px-5 py-3 rounded-xl text-sm"
                style={{ background: t.inputBg, color: t.muted }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:flex h-screen overflow-hidden" style={{ minWidth: '680px' }}>

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
            <button onClick={handleLogout} className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-opacity hover:opacity-60">🚪</button>
          </div>
        </div>

        {/* 목록 패널 */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 300, borderRight: `1px solid ${t.border}`, background: t.surface }}>
          <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: t.text }}>
              {tab === 'friends' ? '친구' : tab === 'chats' ? '채팅' : tab === 'groups' ? '그룹' : '설정'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'friends' && FriendsContent()}
            {tab === 'chats' && ChatsContent({ onRoomClick: (id) => openRoom(id) })}
            {tab === 'groups' && GroupsContent({ onGroupClick: (room) => openGroupRoom(room) })}
            {tab === 'settings' && SettingsContent()}
          </div>
        </div>

        {/* 채팅 패널 */}
        <div className="flex-1 flex overflow-hidden" style={{ background: t.bg }}>
          {activeRoomId ? (
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 채팅 헤더 */}
                <div className="flex-shrink-0 flex items-center gap-3 px-6 h-14" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
                  {activeRoomType === 'dm' ? (
                    <>
                      <Avatar p={activePartner} size={34} />
                      <button onClick={() => setShowPartnerProfile(prev => !prev)} className="flex-1 text-left hover:opacity-70 transition-opacity">
                        <p className="font-semibold text-sm" style={{ color: t.text }}>{activePartner?.nickname || '알 수 없음'}</p>
                        {activePartner?.status_message && <p className="text-xs" style={{ color: t.muted, fontSize: 11 }}>{activePartner.status_message}</p>}
                      </button>
                      <button onClick={() => setShowPartnerProfile(prev => !prev)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                        style={{ background: showPartnerProfile ? t.accentLight : 'transparent', color: showPartnerProfile ? t.accentText : t.muted }}>👤</button>
                    </>
                  ) : (
                    <>
                      <GroupAvatar name={activeGroupRoom?.name ?? ''} size={34} />
                      <button onClick={() => setShowGroupInfo(prev => !prev)} className="flex-1 text-left hover:opacity-70 transition-opacity">
                        <p className="font-semibold text-sm" style={{ color: t.text }}>{activeGroupRoom?.name}</p>
                        <p className="text-xs" style={{ color: t.muted, fontSize: 11 }}>{currentGroupMembers.length}명</p>
                      </button>
                      <button onClick={() => setShowGroupInfo(prev => !prev)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                        style={{ background: showGroupInfo ? t.accentLight : 'transparent', color: showGroupInfo ? t.accentText : t.muted }}>👥</button>
                    </>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {mounted && activeRoomType === 'dm' && renderDMMessages()}
                  {mounted && activeRoomType === 'group' && renderGroupMessages()}
                  <div ref={bottomRef} />
                </div>

                <ChatInput />
              </div>

              {/* DM 파트너 프로필 */}
              {showPartnerProfile && activePartner && activeRoomType === 'dm' && (
                <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 260, borderLeft: `1px solid ${t.border}`, background: t.surface }}>
                  <div className="relative h-28 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
                    <button onClick={() => setShowPartnerProfile(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>✕</button>
                  </div>
                  <div className="px-5 pb-6 flex flex-col items-center text-center -mt-9">
                    <Avatar p={activePartner} size={72} />
                    <h3 className="text-base font-bold mt-3 mb-1" style={{ color: t.text }}>{activePartner.nickname}</h3>
                    {activePartner.status_message
                      ? <p className="text-xs leading-relaxed" style={{ color: t.muted }}>{activePartner.status_message}</p>
                      : <p className="text-xs" style={{ color: t.label }}>상태 메시지 없음</p>}
                    <button onClick={() => setShowPartnerProfile(false)} className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>메시지 보내기</button>
                  </div>
                </div>
              )}

              {/* 그룹 멤버 목록 */}
              {showGroupInfo && activeGroupRoom && activeRoomType === 'group' && (
                <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 260, borderLeft: `1px solid ${t.border}`, background: t.surface }}>
                  <div className="relative h-28 flex-shrink-0 flex items-end pb-4 px-5" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                    <button onClick={() => setShowGroupInfo(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>✕</button>
                    <div>
                      <p className="font-bold text-white text-sm">{activeGroupRoom.name}</p>
                      <p className="text-white/70 text-xs">{currentGroupMembers.length}명</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <p className="px-4 pt-4 pb-2 text-xs font-semibold" style={{ color: t.label }}>멤버</p>
                    {currentGroupMembers.map(member => {
                      const mp = groupMemberProfiles[member.user_id]
                      return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                          <Avatar p={mp} size={36} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: t.text }}>{mp?.nickname || '알 수 없음'}</p>
                            {member.role === 'owner' && (
                              <p className="text-xs" style={{ color: '#f59e0b' }}>방장</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div className="p-4">
                      <button onClick={() => leaveGroup(activeGroupRoom.id)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        그룹 나가기
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-5xl">🐱</p>
              <p className="font-medium text-sm" style={{ color: t.muted }}>대화를 선택해보세요</p>
              <p className="text-xs" style={{ color: t.label }}>친구 탭에서 1:1 채팅, 그룹 탭에서 그룹 채팅을 시작할 수 있어요</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일 레이아웃 ── */}
      <div className="flex flex-col w-full md:hidden">
        <header className="sticky top-0 z-50" style={{ background: t.headerBg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}` }}>
          <div className="max-w-lg mx-auto px-5 h-14 flex items-center">
            <span className="text-base font-bold" style={{ color: t.text }}>교랑톡</span>
          </div>
          <div className="max-w-lg mx-auto px-5 flex gap-5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(({ key, label, badge }) => (
              <button key={key} onClick={() => setTab(key)} className="py-3 text-sm font-medium relative transition-all flex-shrink-0"
                style={{ color: tab === key ? t.tabActive : t.tabInactive, borderBottom: tab === key ? `2px solid ${t.tabActive}` : '2px solid transparent' }}>
                {label}
                {badge > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: '#ef4444', fontSize: 10 }}>{badge}</span>}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 max-w-lg mx-auto w-full">
          {tab === 'friends' && FriendsContent()}
          {tab === 'chats' && ChatsContent({ onRoomClick: (id) => router.push(`/chat/${id}`) })}
          {tab === 'groups' && GroupsContent({ onGroupClick: (room) => { openGroupRoom(room); router.push(`/group/${room.id}`) } })}
          {tab === 'settings' && SettingsContent()}
        </div>
      </div>

    </div>
  )
}