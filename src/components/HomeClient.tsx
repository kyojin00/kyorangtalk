'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar, GroupAvatar } from './TalkAvatars'
import { useThemeColors, fmtTime } from './useTheme'
import { CreateGroupModal, CreateChatModal } from './TalkModals'
import ChatPanel from './ChatPanel'
import { Profile, Friend, Room, GroupRoom, OpenChat } from './types'

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
  const [myGroupRooms, setMyGroupRooms] = useState<GroupRoom[]>([])   // 오픈방 (그룹탭)
  const [chatTabGroups, setChatTabGroups] = useState<GroupRoom[]>([]) // 그룹방 (채팅탭)
  const [publicRooms, setPublicRooms] = useState<GroupRoom[]>([])
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const [groupUnreadMap, setGroupUnreadMap] = useState<Record<string, number>>({})
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateChat, setShowCreateChat] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joiningCode, setJoiningCode] = useState(false)
  const [exploreSearch, setExploreSearch] = useState('')

  const t = useThemeColors(isDark)

  useEffect(() => {
    const saved = localStorage.getItem('kyorangtalk-theme')
    if (saved === 'dark') setIsDark(true)
    loadMyGroups()
    loadSentRequests()
    loadUnreadCounts()
    loadPublicRooms()
    loadGroupUnreadCounts()

    // 내가 새 그룹방에 추가될 때 자동 반영
    const sub = supabase.channel('my-memberships')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kyorangtalk_group_members',
        filter: `user_id=eq.${userId}`,
      }, async payload => {
        const roomId = (payload.new as { room_id: string }).room_id
        const { data: room } = await supabase.from('kyorangtalk_group_rooms').select('*').eq('id', roomId).maybeSingle()
        if (!room) return
        if (room.room_type === 'open') {
          setMyGroupRooms(prev => prev.find(r => r.id === room.id) ? prev : [room, ...prev])
        } else {
          setChatTabGroups(prev => prev.find(r => r.id === room.id) ? prev : [room, ...prev])
        }
      })
      // DM 메시지 INSERT → 목록 last_message 직접 반영
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kyorangtalk_messages',
      }, payload => {
        const msg = payload.new as { room_id: string; content: string; created_at: string; sender_id: string }
        setRoomList(prev => {
          const idx = prev.findIndex(r => r.id === msg.room_id)
          if (idx === -1) return prev
          const updated = { ...prev[idx], last_message: msg.content, last_message_at: msg.created_at }
          const rest = prev.filter(r => r.id !== msg.room_id)
          return [updated, ...rest]
        })
        // 안읽음 뱃지 업데이트
        if (msg.sender_id !== userId) {
          setUnreadMap(prev => ({ ...prev, [msg.room_id]: (prev[msg.room_id] || 0) + 1 }))
        }
      })
      // 그룹 메시지 INSERT → 목록 last_message 직접 반영
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'kyorangtalk_group_messages',
      }, payload => {
        const msg = payload.new as { room_id: string; content: string; created_at: string; msg_type: string; sender_id: string }
        if (msg.msg_type !== 'message') return
        const update = { last_message: msg.content, last_message_at: msg.created_at }
        const applyUpdate = (prev: GroupRoom[]) => {
          const idx = prev.findIndex(r => r.id === msg.room_id)
          if (idx === -1) return prev
          const updated = { ...prev[idx], ...update }
          return [updated, ...prev.filter(r => r.id !== msg.room_id)]
        }
        setMyGroupRooms(applyUpdate)
        setChatTabGroups(applyUpdate)
        // 상대방 메시지면 안읽음 뱃지 추가
        if (msg.sender_id !== userId) {
          setGroupUnreadMap(prev => ({ ...prev, [msg.room_id]: (prev[msg.room_id] || 0) + 1 }))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [])

  const loadUnreadCounts = async () => {
    const { data } = await supabase.from('kyorangtalk_messages').select('room_id').eq('is_read', false).neq('sender_id', userId)
    if (data) { const c: Record<string, number> = {}; data.forEach(m => { c[m.room_id] = (c[m.room_id] || 0) + 1 }); setUnreadMap(c) }
  }

  const loadGroupUnreadCounts = async () => {
    const { data: reads } = await supabase.from('kyorangtalk_group_reads').select('room_id, last_read_at').eq('user_id', userId)
    const readMap: Record<string, string> = {}
    reads?.forEach(r => { readMap[r.room_id] = r.last_read_at })

    const { data: memberRows } = await supabase.from('kyorangtalk_group_members').select('room_id').eq('user_id', userId)
    if (!memberRows?.length) return

    const counts: Record<string, number> = {}
    for (const row of memberRows) {
      const lastRead = readMap[row.room_id]
      let query = supabase
        .from('kyorangtalk_group_messages')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', row.room_id)
        .neq('sender_id', userId)
        .eq('msg_type', 'message')
      if (lastRead) query = query.gt('created_at', lastRead)
      const { count } = await query
      if (count && count > 0) counts[row.room_id] = count
    }
    setGroupUnreadMap(counts)
  }

  const handleMarkRead = (roomId: string) => {
    setUnreadMap(prev => { const n = { ...prev }; delete n[roomId]; return n })
    setGroupUnreadMap(prev => { const n = { ...prev }; delete n[roomId]; return n })
  }

  const loadMyGroups = async () => {
    const { data: memberRows } = await supabase.from('kyorangtalk_group_members').select('room_id').eq('user_id', userId)
    if (!memberRows?.length) return
    const { data } = await supabase.from('kyorangtalk_group_rooms').select('*').in('id', memberRows.map(m => m.room_id)).order('created_at', { ascending: false })
    if (data) {
      setMyGroupRooms(data.filter(r => r.room_type === 'open'))   // 오픈방 → 그룹탭
      setChatTabGroups(data.filter(r => r.room_type === 'group')) // 그룹방 → 채팅탭
    }
  }

  const loadPublicRooms = async () => {
    const { data } = await supabase.from('kyorangtalk_group_rooms').select('*').eq('room_type', 'open').order('member_count', { ascending: false }).limit(50)
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
    if (!openChats.find(c => c.id === room.id)) setOpenChats(prev => [...prev, { id: room.id, type: 'dm', room }])
  }

  const openGroupChat = (groupRoom: GroupRoom) => {
    if (!openChats.find(c => c.id === groupRoom.id)) setOpenChats(prev => [...prev, { id: groupRoom.id, type: 'group', groupRoom }])
  }

  const closeChat = (id: string) => setOpenChats(prev => prev.filter(c => c.id !== id))

  const handleLeaveGroup = (roomId: string) => {
    setMyGroupRooms(prev => prev.filter(r => r.id !== roomId))
    setChatTabGroups(prev => prev.filter(r => r.id !== roomId))
  }

  const startChat = async (friendUserId: string) => {
    const u1 = userId < friendUserId ? userId : friendUserId
    const u2 = userId < friendUserId ? friendUserId : userId
    const { data: ex } = await supabase.from('kyorangtalk_rooms').select('*').eq('user1_id', u1).eq('user2_id', u2).maybeSingle()
    if (ex) { openDMChat(ex); setTab('chats'); return }
    const { data: nr } = await supabase.from('kyorangtalk_rooms').insert({ user1_id: u1, user2_id: u2 }).select().single()
    if (nr) { setRoomList(prev => [nr, ...prev]); openDMChat(nr); setTab('chats') }
  }

  const sendJoinMessage = async (roomId: string, nickname: string) => {
    await supabase.from('kyorangtalk_group_messages').insert({
      room_id: roomId,
      sender_id: userId,
      content: `${nickname}님이 입장했어요.`,
      msg_type: 'system',
    })
  }

  const joinGroupByCode = async () => {
    if (!joinCode.trim()) return
    setJoiningCode(true)
    const { data: room } = await supabase.from('kyorangtalk_group_rooms').select('*').eq('invite_code', joinCode.trim()).single()
    if (!room) { alert('유효하지 않은 코드예요'); setJoiningCode(false); return }
    const { data: ex } = await supabase.from('kyorangtalk_group_members').select('id').eq('room_id', room.id).eq('user_id', userId).maybeSingle()
    if (!ex) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'member' })
      await supabase.from('kyorangtalk_group_rooms').update({ member_count: (room.member_count || 1) + 1 }).eq('id', room.id)
      // 오픈방이면 입장 메시지 + 목록 추가, 그룹방이면 채팅탭에 추가
      if (room.room_type === 'open') {
        setMyGroupRooms(prev => [room, ...prev])
        await sendJoinMessage(room.id, profile.nickname)
      } else {
        setChatTabGroups(prev => [room, ...prev])
      }
    }
    setJoinCode('')
    openGroupChat(room)
    setTab(room.room_type === 'open' ? 'groups' : 'chats')
    setJoiningCode(false)
  }

  const joinPublicRoom = async (room: GroupRoom) => {
    const { data: ex } = await supabase.from('kyorangtalk_group_members').select('id').eq('room_id', room.id).eq('user_id', userId).maybeSingle()
    if (!ex) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'member' })
      await supabase.from('kyorangtalk_group_rooms').update({ member_count: (room.member_count || 1) + 1 }).eq('id', room.id)
      setMyGroupRooms(prev => [room, ...prev])
      await sendJoinMessage(room.id, profile.nickname)
    }
    openGroupChat(room)
    setTab('groups')
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
    if (ex?.length) { alert(ex[0].status === 'accepted' ? '이미 친구예요!' : '이미 요청이 있어요!'); return }
    const { data, error } = await supabase.from('kyorangtalk_friends').insert({ requester_id: userId, receiver_id: receiverId }).select().single()
    if (!error && data) { setSentList(prev => [...prev, data]); setSearchResults([]); alert('친구 요청을 보냈어요!') }
  }

  const cancelFriendRequest = async (id: string) => {
    await supabase.from('kyorangtalk_friends').delete().eq('id', id)
    setSentList(prev => prev.filter(f => f.id !== id))
  }

  const acceptFriend = async (id: string) => {
    await supabase.from('kyorangtalk_friends').update({ status: 'accepted' }).eq('id', id)
    const acc = pendingList.find(p => p.id === id)
    if (acc) {
      setFriendList(prev => [...prev, { ...acc, status: 'accepted' }])
      setPendingList(prev => prev.filter(p => p.id !== id))
      const { data: p } = await supabase.from('kyorangtalk_profiles').select('*').eq('id', acc.requester_id).single()
      if (p) setPMap(prev => ({ ...prev, [p.id]: p }))
    }
  }

  const rejectFriend = async (id: string) => {
    await supabase.from('kyorangtalk_friends').delete().eq('id', id)
    setPendingList(prev => prev.filter(p => p.id !== id))
  }

  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id
  const getPartner = (r: Room) => pMap[r.user1_id === userId ? r.user2_id : r.user1_id]
  const toggleTheme = (dark: boolean) => { setIsDark(dark); localStorage.setItem('kyorangtalk-theme', dark ? 'dark' : 'light') }

  const dmUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0)
  const chatGroupUnread = chatTabGroups.reduce((a, r) => a + (groupUnreadMap[r.id] || 0), 0)
  const groupTabUnread = myGroupRooms.reduce((a, r) => a + (groupUnreadMap[r.id] || 0), 0)
  const joinedIds = new Set(myGroupRooms.map(r => r.id))
  const filteredPublic = publicRooms.filter(r => !exploreSearch || r.name.includes(exploreSearch) || r.description?.includes(exploreSearch))

  const tabs = [
    { key: 'friends' as const, icon: '👥', badge: pendingList.length },
    { key: 'chats' as const, icon: '💬', badge: dmUnread + chatGroupUnread },
    { key: 'groups' as const, icon: '🌐', badge: groupTabUnread },
    { key: 'explore' as const, icon: '🔍', badge: 0 },
    { key: 'settings' as const, icon: '⚙️', badge: 0 },
  ]
  const tabLabel: Record<string, string> = { friends: '친구', chats: '채팅', groups: '오픈방', explore: '탐색', settings: '설정' }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: t.bg }}>

      {showCreateGroup && (
        <CreateGroupModal userId={userId} isDark={isDark}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(room) => {
            setMyGroupRooms(prev => [room, ...prev])
            if (room.room_type === 'open') setPublicRooms(prev => [room, ...prev])
            setShowCreateGroup(false)
            openGroupChat(room)
            setTab('groups')
          }} />
      )}

      {showCreateChat && (
        <CreateChatModal
          userId={userId} profile={profile} friendList={friendList} pMap={pMap} isDark={isDark}
          onClose={() => setShowCreateChat(false)}
          onStartDM={async (fId) => { await startChat(fId); setTab('chats') }}
          onStartGroup={(room) => {
            setChatTabGroups(prev => [room, ...prev])
            openGroupChat(room)
            setTab('chats')
          }} />
      )}

      {/* 사이드바 */}
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
          <h2 className="font-bold text-sm" style={{ color: t.text }}>{tabLabel[tab]}</h2>
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
                  <input type="text" placeholder="닉네임 검색" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
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
              {pendingList.length > 0 && (
                <div>
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
                </div>
              )}
              {sentList.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.label }}>보낸 요청 {sentList.length}</p>
                  {sentList.map(req => (
                    <div key={req.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <div className="flex items-center gap-2.5"><Avatar p={pMap[req.receiver_id]} size={36} />
                        <div><p className="text-sm font-medium" style={{ color: t.text }}>{pMap[req.receiver_id]?.nickname || '알 수 없음'}</p><p className="text-xs" style={{ color: t.muted }}>대기 중</p></div>
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
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setShowCreateChat(true)} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>+ 새 채팅</button>
              </div>
              {roomList.map(room => {
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
              })}
              {chatTabGroups.map(room => {
                const unread = groupUnreadMap[room.id] || 0; const isOpen = !!openChats.find(c => c.id === room.id)
                return (
                  <button key={room.id} onClick={() => openGroupChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70"
                    style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                    <div className="relative"><GroupAvatar name={room.name} size={42} />
                      {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{unread}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: t.accentLight, color: t.accentText, fontSize: 10 }}>그룹</span>
                      </div>
                      <p className="text-xs" style={{ color: t.muted }}>{room.member_count}명</p>
                    </div>
                  </button>
                )
              })}
              {roomList.length === 0 && chatTabGroups.length === 0 && (
                <div className="text-center py-16"><p className="text-3xl mb-3">💬</p><p className="text-sm" style={{ color: t.muted }}>채팅이 없어요</p></div>
              )}
            </div>
          )}

          {/* 오픈방 탭 */}
          {tab === 'groups' && (
            <div>
              <div className="px-4 py-3 space-y-2" style={{ borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setShowCreateGroup(true)} className="w-full py-2 rounded-xl text-sm font-medium text-white" style={{ background: t.accent }}>+ 새 오픈방 만들기</button>
                <div className="flex gap-2">
                  <input type="text" placeholder="초대 코드 입력" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && joinGroupByCode()}
                    className="flex-1 text-sm rounded-xl px-3 py-2 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
                  <button onClick={joinGroupByCode} disabled={!joinCode.trim() || joiningCode}
                    className="text-xs px-3 py-2 rounded-xl font-medium text-white disabled:opacity-50" style={{ background: t.accent }}>참여</button>
                </div>
              </div>
              {myGroupRooms.length === 0
                ? <div className="text-center py-16"><p className="text-3xl mb-3">🌐</p><p className="text-sm" style={{ color: t.muted }}>참여한 오픈방이 없어요</p></div>
                : myGroupRooms.map(room => {
                  const unread = groupUnreadMap[room.id] || 0; const isOpen = !!openChats.find(c => c.id === room.id)
                  return (
                    <button key={room.id} onClick={() => openGroupChat(room)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:opacity-70"
                      style={{ borderBottom: `1px solid ${t.borderSub}`, background: isOpen ? t.accentLight : 'transparent' }}>
                      <div className="relative"><GroupAvatar name={room.name} size={42} />
                        {unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold" style={{ background: '#ef4444', fontSize: 9 }}>{unread}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: t.accentLight, color: t.accentText, fontSize: 10 }}>오픈</span>
                        </div>
                        <p className="text-xs" style={{ color: t.muted }}>{room.member_count}명 · {room.description || '오픈 채팅방'}</p>
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
                <input type="text" placeholder="오픈방 검색..." value={exploreSearch} onChange={e => setExploreSearch(e.target.value)}
                  className="w-full text-sm rounded-xl px-4 py-2.5 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              </div>
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold" style={{ color: t.label }}>오픈방 {filteredPublic.length}개</p>
              {filteredPublic.length === 0
                ? <div className="text-center py-12"><p className="text-3xl mb-3">🔍</p><p className="text-sm" style={{ color: t.muted }}>오픈방이 없어요</p></div>
                : filteredPublic.map(room => {
                  const alreadyJoined = joinedIds.has(room.id)
                  return (
                    <div key={room.id} className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${t.borderSub}` }}>
                      <GroupAvatar name={room.name} size={42} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: t.text }}>{room.name}</p>
                        <p className="text-xs" style={{ color: t.muted }}>{room.member_count}명 · {room.description || '오픈 채팅방'}</p>
                      </div>
                      <button onClick={() => joinPublicRoom(room)} className="text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0"
                        style={alreadyJoined ? { background: t.accentLight, color: t.accentText } : { background: t.accent, color: 'white' }}>
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
            <ChatPanel
              openChat={chat} userId={userId} pMap={pMap} isDark={isDark}
              onClose={closeChat}
              onMarkRead={handleMarkRead}
              onLeaveGroup={handleLeaveGroup}
            />
          </div>
        ))}
      </div>
    </div>
  )
}