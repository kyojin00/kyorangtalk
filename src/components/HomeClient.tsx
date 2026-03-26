'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null; updated_at: string }

const Avatar = ({ p, size = 40 }: { p: Profile | null | undefined; size?: number }) => (
  <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0"
    style={{ width: size, height: size, background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', fontSize: size * 0.38, position: 'relative' }}>
    {p?.avatar_url
      ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} />
      : <span>{p?.nickname?.[0] || '?'}</span>}
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
  const [tab, setTab] = useState<'friends' | 'chats'>('friends')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [friendList, setFriendList] = useState(friends)
  const [pendingList, setPendingList] = useState(pending)
  const [pMap, setPMap] = useState(profileMap)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('kyorangtalk_profiles')
      .select('*')
      .ilike('nickname', `%${searchQuery}%`)
      .neq('id', userId)
      .limit(10)
    setSearchResults(data || [])
    setSearching(false)
  }

  const sendFriendRequest = async (receiverId: string) => {
    const { data: existing } = await supabase
      .from('kyorangtalk_friends')
      .select('*')
      .or(`and(requester_id.eq.${userId},receiver_id.eq.${receiverId}),and(requester_id.eq.${receiverId},receiver_id.eq.${userId})`)
      .limit(1)
    if (existing && existing.length > 0) {
      alert(existing[0].status === 'accepted' ? '이미 친구예요!' : '이미 친구 요청이 있어요!')
      return
    }
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
    if (existing) { router.push(`/chat/${existing.id}`); return }
    const { data: newRoom } = await supabase.from('kyorangtalk_rooms').insert({ user1_id, user2_id }).select().single()
    if (newRoom) router.push(`/chat/${newRoom.id}`)
  }

  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id
  const getPartner = (room: Room) => {
    const pid = room.user1_id === userId ? room.user2_id : room.user1_id
    return pMap[pid]
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    if (diff < 172800000) return '어제'
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0f14', fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* 헤더 */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-lg mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight" style={{ color: '#e2d9f3' }}>교랑톡</span>
          <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-full transition-opacity hover:opacity-60" style={{ color: '#7c7c8a', border: '1px solid rgba(255,255,255,0.08)' }}>로그아웃</button>
        </div>

        {/* 탭 */}
        <div className="max-w-lg mx-auto px-5 flex gap-6">
          {(['friends', 'chats'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="py-3 text-sm font-medium relative transition-all" style={{ color: tab === t ? '#a78bfa' : '#5a5a6e', borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent' }}>
              {t === 'friends' ? '친구' : '채팅'}
              {t === 'friends' && pendingList.length > 0 && (
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: '#7c3aed', color: 'white', fontSize: '10px' }}>{pendingList.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full">

        {/* 친구 탭 */}
        {tab === 'friends' && (
          <div>
            {/* 내 프로필 */}
            <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-4 px-5 py-5 transition-opacity hover:opacity-70 text-left" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="relative">
                <Avatar p={profile} size={52} />
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full" style={{ background: '#22c55e', border: '2px solid #0f0f14' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#e2d9f3' }}>{profile.nickname}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#5a5a6e' }}>{profile.status_message || '상태 메시지를 설정해보세요'}</p>
              </div>
              <span style={{ color: '#3d3d52', fontSize: 12 }}>✏️</span>
            </button>

            {/* 검색 */}
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="닉네임으로 친구 찾기"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2d9f3' }}
                />
                <button onClick={handleSearch} disabled={searching} className="px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-80" style={{ background: '#7c3aed', color: 'white' }}>
                  {searching ? '...' : '검색'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                  {searchResults.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div className="flex items-center gap-3">
                        <Avatar p={r} size={36} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#e2d9f3' }}>{r.nickname}</p>
                          {r.status_message && <p className="text-xs" style={{ color: '#5a5a6e' }}>{r.status_message}</p>}
                        </div>
                      </div>
                      <button onClick={() => sendFriendRequest(r.id)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>추가</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 받은 요청 */}
            {pendingList.length > 0 && (
              <div>
                <p className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wider uppercase" style={{ color: '#4a4a5e' }}>받은 친구 요청</p>
                {pendingList.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-3">
                      <Avatar p={pMap[req.requester_id]} size={40} />
                      <p className="text-sm font-medium" style={{ color: '#e2d9f3' }}>{pMap[req.requester_id]?.nickname || '알 수 없음'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: '#7c3aed', color: 'white' }}>수락</button>
                      <button onClick={() => rejectFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: '#5a5a6e' }}>거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 친구 목록 */}
            {friendList.length > 0 && (
              <div>
                <p className="px-5 pt-4 pb-2 text-xs font-semibold tracking-wider uppercase" style={{ color: '#4a4a5e' }}>친구 {friendList.length}명</p>
                {friendList.map((f) => {
                  const fId = getFriendUserId(f)
                  const fp = pMap[fId]
                  return (
                    <div key={f.id} className="flex items-center justify-between px-5 py-3 transition-opacity hover:opacity-70" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <Avatar p={fp} size={40} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#e2d9f3' }}>{fp?.nickname || '알 수 없음'}</p>
                          {fp?.status_message && <p className="text-xs mt-0.5" style={{ color: '#5a5a6e' }}>{fp.status_message}</p>}
                        </div>
                      </div>
                      <button onClick={() => startChat(fId)} className="text-xs px-3 py-1.5 rounded-full font-medium" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>채팅</button>
                    </div>
                  )
                })}
              </div>
            )}

            {friendList.length === 0 && pendingList.length === 0 && (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">🐱</p>
                <p className="text-sm" style={{ color: '#4a4a5e' }}>아직 친구가 없어요<br />닉네임으로 검색해보세요</p>
              </div>
            )}
          </div>
        )}

        {/* 채팅 탭 */}
        {tab === 'chats' && (
          <div>
            {rooms.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-4xl mb-4">💬</p>
                <p className="text-sm" style={{ color: '#4a4a5e' }}>아직 채팅이 없어요<br />친구 탭에서 채팅을 시작해보세요</p>
              </div>
            ) : (
              rooms.map((room) => {
                const partner = getPartner(room)
                return (
                  <button key={room.id} onClick={() => router.push(`/chat/${room.id}`)} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-opacity hover:opacity-70" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <Avatar p={partner} size={48} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm" style={{ color: '#e2d9f3' }}>{partner?.nickname || '알 수 없음'}</span>
                        {room.last_message_at && <span className="text-xs" style={{ color: '#4a4a5e' }}>{formatTime(room.last_message_at)}</span>}
                      </div>
                      <p className="text-xs truncate" style={{ color: '#5a5a6e' }}>{room.last_message || '대화를 시작해보세요'}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}