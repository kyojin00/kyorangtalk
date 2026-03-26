'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null; updated_at: string }
interface Message { id: string; room_id: string; sender_id: string; content: string; created_at: string }

const Avatar = ({ p, size = 40 }: { p: Profile | null | undefined; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative', color: 'white' }}>
    {p?.avatar_url ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} /> : <span>{p?.nickname?.[0] || '?'}</span>}
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
  const [tab, setTab] = useState<'friends' | 'chats' | 'settings'>('friends')
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [friendList, setFriendList] = useState(friends)
  const [pendingList, setPendingList] = useState(pending)
  const [pMap, setPMap] = useState(profileMap)
  const [roomList, setRoomList] = useState(rooms)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [activeMessages, setActiveMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showPartnerProfile, setShowPartnerProfile] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  useEffect(() => {
    if (!activeRoomId) return
    const channel = supabase.channel(`room:${activeRoomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kyorangtalk_messages', filter: `room_id=eq.${activeRoomId}` },
        (payload) => setActiveMessages(prev => [...prev, payload.new as Message]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeRoomId])

  const openRoom = async (roomId: string) => {
    setActiveRoomId(roomId)
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
    const { error } = await supabase.from('kyorangtalk_messages').insert({ room_id: activeRoomId, sender_id: userId, content })
    if (!error) {
      await supabase.from('kyorangtalk_rooms').update({ last_message: content, last_message_at: new Date().toISOString() }).eq('id', activeRoomId)
      setRoomList(prev => prev.map(r => r.id === activeRoomId ? { ...r, last_message: content, last_message_at: new Date().toISOString() } : r))
    }
    setChatSending(false)
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
    overlay: 'rgba(0,0,0,0.5)',
  }

  const tabs = [
    { key: 'friends' as const, label: '친구', icon: '👥', badge: pendingList.length },
    { key: 'chats' as const, label: '채팅', icon: '💬', badge: 0 },
    { key: 'settings' as const, label: '설정', icon: '⚙️', badge: 0 },
  ]

  const renderChatMessages = () => {
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
              {isLastInGroup && (
                <button onClick={() => setShowPartnerProfile(true)}>
                  <Avatar p={activePartner} size={28} />
                </button>
              )}
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
            style={{ background: t.accent, color: 'white', borderRadius: 12, padding: '10px 16px', whiteSpace: 'nowrap' }}>
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
          const isActive = room.id === activeRoomId
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

  return (
    <div className="min-h-screen" style={{ background: t.bg }}>

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
            <button onClick={handleLogout} className="w-10 h-10 rounded-xl flex items-center justify-center text-base transition-opacity hover:opacity-60" title="로그아웃">🚪</button>
          </div>
        </div>

        {/* 목록 패널 */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ width: 300, borderRight: `1px solid ${t.border}`, background: t.surface }}>
          <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${t.border}` }}>
            <h2 className="font-bold text-sm" style={{ color: t.text }}>
              {tab === 'friends' ? '친구' : tab === 'chats' ? '채팅' : '설정'}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === 'friends' && <FriendsContent />}
            {tab === 'chats' && <ChatsContent onRoomClick={(id) => openRoom(id)} />}
            {tab === 'settings' && <SettingsContent />}
          </div>
        </div>

        {/* 채팅 + 프로필 패널 */}
        <div className="flex-1 flex overflow-hidden" style={{ background: t.bg }}>
          {activeRoomId && activeRoom ? (
            <>
              {/* 채팅 영역 */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 flex items-center gap-3 px-6 h-14" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
                  <Avatar p={activePartner} size={34} />
                  <button onClick={() => setShowPartnerProfile(prev => !prev)} className="flex-1 text-left hover:opacity-70 transition-opacity">
                    <p className="font-semibold text-sm" style={{ color: t.text }}>{activePartner?.nickname || '알 수 없음'}</p>
                    {activePartner?.status_message && <p className="text-xs" style={{ color: t.muted, fontSize: 11 }}>{activePartner.status_message}</p>}
                  </button>
                  <button
                    onClick={() => setShowPartnerProfile(prev => !prev)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-sm"
                    style={{ background: showPartnerProfile ? t.accentLight : 'transparent', color: showPartnerProfile ? t.accentText : t.muted }}
                  >👤</button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {mounted && renderChatMessages()}
                  <div ref={bottomRef} />
                </div>

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
              </div>

              {/* 프로필 사이드패널 */}
              {showPartnerProfile && activePartner && (
                <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{ width: 260, borderLeft: `1px solid ${t.border}`, background: t.surface }}>
                  <div className="relative h-28 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}>
                    <button onClick={() => setShowPartnerProfile(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>✕</button>
                  </div>
                  <div className="px-5 pb-6 flex flex-col items-center text-center -mt-9">
                    <Avatar p={activePartner} size={72} />
                    <h3 className="text-base font-bold mt-3 mb-1" style={{ color: t.text }}>{activePartner.nickname}</h3>
                    {activePartner.status_message
                      ? <p className="text-xs leading-relaxed" style={{ color: t.muted }}>{activePartner.status_message}</p>
                      : <p className="text-xs" style={{ color: t.label }}>상태 메시지 없음</p>
                    }
                    <button onClick={() => setShowPartnerProfile(false)} className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>메시지 보내기</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-5xl">🐱</p>
              <p className="font-medium text-sm" style={{ color: t.muted }}>대화를 선택해보세요</p>
              <p className="text-xs" style={{ color: t.label }}>친구 탭에서 채팅을 시작할 수 있어요</p>
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
          <div className="max-w-lg mx-auto px-5 flex gap-6">
            {tabs.map(({ key, label, badge }) => (
              <button key={key} onClick={() => setTab(key)} className="py-3 text-sm font-medium relative transition-all" style={{ color: tab === key ? t.tabActive : t.tabInactive, borderBottom: tab === key ? `2px solid ${t.tabActive}` : '2px solid transparent' }}>
                {label}
                {badge > 0 && <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold text-white" style={{ background: '#ef4444', fontSize: 10 }}>{badge}</span>}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 max-w-lg mx-auto w-full">
          {tab === 'friends' && <FriendsContent />}
          {tab === 'chats' && <ChatsContent onRoomClick={(id) => router.push(`/chat/${id}`)} />}
          {tab === 'settings' && <SettingsContent />}
        </div>
      </div>

    </div>
  )
}