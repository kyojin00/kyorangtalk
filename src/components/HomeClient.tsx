'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Profile { id: string; nickname: string; avatar_url?: string | null; status_message?: string | null }
interface Friend { id: string; requester_id: string; receiver_id: string; status: string }
interface Room { id: string; user1_id: string; user2_id: string; last_message: string | null; last_message_at: string | null; updated_at: string }

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
  const [tab, setTab] = useState<'chats' | 'friends'>('chats')
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
      const rel = existing[0]
      if (rel.status === 'accepted') { alert('이미 친구예요!'); return }
      if (rel.status === 'pending') { alert('이미 친구 요청이 있어요!'); return }
    }

    const { error } = await supabase
      .from('kyorangtalk_friends')
      .insert({ requester_id: userId, receiver_id: receiverId })
    if (error) alert('오류가 발생했어요.')
    else { alert('친구 요청을 보냈어요!'); setSearchResults([]) }
  }

  const acceptFriend = async (friendId: string) => {
    const { error } = await supabase
      .from('kyorangtalk_friends')
      .update({ status: 'accepted' })
      .eq('id', friendId)
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

    const { data: existing } = await supabase
      .from('kyorangtalk_rooms')
      .select('*')
      .eq('user1_id', user1_id)
      .eq('user2_id', user2_id)
      .single()

    if (existing) { router.push(`/chat/${existing.id}`); return }

    const { data: newRoom } = await supabase
      .from('kyorangtalk_rooms')
      .insert({ user1_id, user2_id })
      .select()
      .single()

    if (newRoom) router.push(`/chat/${newRoom.id}`)
  }

  const getFriendUserId = (friend: Friend) =>
    friend.requester_id === userId ? friend.receiver_id : friend.requester_id

  const getPartnerNickname = (room: Room) => {
    const partnerId = room.user1_id === userId ? room.user2_id : room.user1_id
    return pMap[partnerId]?.nickname || '알 수 없음'
  }

  const getPartnerAvatar = (room: Room) => {
    const partnerId = room.user1_id === userId ? room.user2_id : room.user1_id
    return pMap[partnerId]?.avatar_url || null
  }

  const Avatar = ({ p, size = 40 }: { p: Profile | null | undefined, size?: number }) => (
    <div className="rounded-full overflow-hidden flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: 'var(--purple)', fontSize: size * 0.35, position: 'relative' }}>
      {p?.avatar_url ? (
        <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} />
      ) : (
        <span>{p?.nickname?.[0] || '?'}</span>
      )}
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-50" style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--purple-dark)' }}>교랑톡</h1>
          </div>
          <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-full" style={{ color: 'var(--muted)', background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.15)' }}>로그아웃</button>
        </div>
        <div className="max-w-lg mx-auto px-4 flex">
          <button onClick={() => setTab('chats')} className="flex-1 py-2.5 text-sm font-medium transition-all" style={{ color: tab === 'chats' ? 'var(--purple)' : 'var(--muted)', borderBottom: tab === 'chats' ? '2px solid var(--purple)' : '2px solid transparent' }}>채팅</button>
          <button onClick={() => setTab('friends')} className="flex-1 py-2.5 text-sm font-medium transition-all relative" style={{ color: tab === 'friends' ? 'var(--purple)' : 'var(--muted)', borderBottom: tab === 'friends' ? '2px solid var(--purple)' : '2px solid transparent' }}>
            친구
            {pendingList.length > 0 && <span className="absolute top-2 right-8 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ background: '#E74C3C' }}>{pendingList.length}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {tab === 'chats' && (
          <div>
            {/* 내 프로필 카드 */}
            <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-4 px-4 py-4 hover:opacity-80 transition text-left" style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.08)' }}>
              <Avatar p={profile} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{profile.nickname}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{profile.status_message || '상태 메시지를 설정해보세요'}</p>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>✏️</span>
            </button>

            <div className="p-4 space-y-2">
              {rooms.length === 0 ? (
                <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
                  아직 채팅이 없어요<br />친구 탭에서 친구를 추가해보세요 🐱
                </div>
              ) : (
                rooms.map((room) => (
                  <button key={room.id} onClick={() => router.push(`/chat/${room.id}`)} className="w-full rounded-xl p-4 flex items-center gap-3 hover:opacity-80 transition text-left" style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.1)' }}>
                    <Avatar p={{ id: '', nickname: getPartnerNickname(room), avatar_url: getPartnerAvatar(room) }} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{getPartnerNickname(room)}</span>
                        {room.last_message_at && <span className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(room.last_message_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{room.last_message || '대화를 시작해보세요'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'friends' && (
          <div className="p-4 space-y-4">
            {/* 내 프로필 카드 */}
            <button onClick={() => router.push('/profile')} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:opacity-80 transition text-left" style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.1)' }}>
              <Avatar p={profile} size={48} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{profile.nickname}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{profile.status_message || '상태 메시지를 설정해보세요'}</p>
              </div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>✏️</span>
            </button>

            {/* 친구 검색 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="닉네임으로 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.15)', color: 'var(--text)' }}
              />
              <button onClick={handleSearch} disabled={searching} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--purple)' }}>검색</button>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
                <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>검색 결과</p>
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <Avatar p={result} size={36} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{result.nickname}</p>
                        {result.status_message && <p className="text-xs" style={{ color: 'var(--muted)' }}>{result.status_message}</p>}
                      </div>
                    </div>
                    <button onClick={() => sendFriendRequest(result.id)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--purple)' }}>친구 추가</button>
                  </div>
                ))}
              </div>
            )}

            {/* 받은 친구 요청 */}
            {pendingList.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
                <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>받은 친구 요청 {pendingList.length}개</p>
                {pendingList.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <Avatar p={pMap[req.requester_id]} size={36} />
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{pMap[req.requester_id]?.nickname || '알 수 없음'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--purple)' }}>수락</button>
                      <button onClick={() => rejectFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid rgba(108,92,231,0.15)' }}>거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 친구 목록 */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
              <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>친구 {friendList.length}명</p>
              {friendList.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>아직 친구가 없어요</div>
              ) : (
                friendList.map((friend) => {
                  const fId = getFriendUserId(friend)
                  const fp = pMap[fId]
                  return (
                    <div key={friend.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                      <div className="flex items-center gap-3">
                        <Avatar p={fp} size={36} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{fp?.nickname || '알 수 없음'}</p>
                          {fp?.status_message && <p className="text-xs" style={{ color: 'var(--muted)' }}>{fp.status_message}</p>}
                        </div>
                      </div>
                      <button onClick={() => startChat(fId)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--purple)' }}>채팅</button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}