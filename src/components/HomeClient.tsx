'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile { id: string; nickname: string }
interface Friend {
  id: string
  requester_id: string
  receiver_id: string
  status: string
  requester?: { id: string; kyorangtalk_profiles: { nickname: string } | null }
  receiver?: { id: string; kyorangtalk_profiles: { nickname: string } | null }
}
interface Room {
  id: string
  user1_id: string
  user2_id: string
  last_message: string | null
  last_message_at: string | null
  updated_at: string
}

export default function HomeClient({ userId, profile, friends, pending, rooms }: {
  userId: string
  profile: Profile
  friends: Friend[]
  pending: Friend[]
  rooms: Room[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'chats' | 'friends'>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [friendList, setFriendList] = useState(friends)
  const [pendingList, setPendingList] = useState(pending)

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
    const { error } = await supabase
      .from('kyorangtalk_friends')
      .insert({ requester_id: userId, receiver_id: receiverId })
    if (error) alert('이미 친구 요청을 보냈거나 이미 친구예요.')
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

  const getFriendProfile = (friend: Friend) => {
    if (friend.requester_id === userId) return friend.receiver?.kyorangtalk_profiles
    return friend.requester?.kyorangtalk_profiles
  }

  const getFriendUserId = (friend: Friend) => {
    return friend.requester_id === userId ? friend.receiver_id : friend.requester_id
  }

  const getPartnerNickname = (room: Room) => {
    const partnerId = room.user1_id === userId ? room.user2_id : room.user1_id
    const friend = friendList.find(f => getFriendUserId(f) === partnerId)
    return friend ? getFriendProfile(friend)?.nickname : '알 수 없음'
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="sticky top-0 z-50" style={{ background: 'var(--surface)', borderBottom: '1px solid rgba(108,92,231,0.1)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐱</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--purple-dark)' }}>교랑톡</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>{profile.nickname}</span>
            <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-full" style={{ color: 'var(--muted)', background: 'var(--bg)', border: '1px solid rgba(108,92,231,0.15)' }}>로그아웃</button>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 flex">
          <button onClick={() => setTab('chats')} className="flex-1 py-2.5 text-sm font-medium transition-all" style={{ color: tab === 'chats' ? 'var(--purple)' : 'var(--muted)', borderBottom: tab === 'chats' ? '2px solid var(--purple)' : '2px solid transparent' }}>채팅</button>
          <button onClick={() => setTab('friends')} className="flex-1 py-2.5 text-sm font-medium transition-all relative" style={{ color: tab === 'friends' ? 'var(--purple)' : 'var(--muted)', borderBottom: tab === 'friends' ? '2px solid var(--purple)' : '2px solid transparent' }}>
            친구
            {pendingList.length > 0 && <span className="absolute top-2 right-8 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center" style={{ background: '#E74C3C' }}>{pendingList.length}</span>}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4">
        {tab === 'chats' && (
          <div className="space-y-2">
            {rooms.length === 0 ? (
              <div className="text-center py-16 text-sm" style={{ color: 'var(--muted)' }}>
                아직 채팅이 없어요<br />친구 탭에서 친구를 추가해보세요 🐱
              </div>
            ) : (
              rooms.map((room) => (
                <button key={room.id} onClick={() => router.push(`/chat/${room.id}`)} className="w-full rounded-xl p-4 flex items-center gap-3 hover:opacity-80 transition text-left" style={{ background: 'var(--surface)', border: '1px solid rgba(108,92,231,0.1)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'var(--purple)' }}>
                    {getPartnerNickname(room)?.[0] || '?'}
                  </div>
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
        )}

        {tab === 'friends' && (
          <div className="space-y-4">
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

            {searchResults.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
                <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>검색 결과</p>
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: 'var(--purple)' }}>{result.nickname[0]}</div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{result.nickname}</span>
                    </div>
                    <button onClick={() => sendFriendRequest(result.id)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--purple)' }}>친구 추가</button>
                  </div>
                ))}
              </div>
            )}

            {pendingList.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
                <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>받은 친구 요청 {pendingList.length}개</p>
                {pendingList.map((req) => (
                  <div key={req.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: 'var(--purple)' }}>{req.requester?.kyorangtalk_profiles?.nickname?.[0] || '?'}</div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{req.requester?.kyorangtalk_profiles?.nickname || '알 수 없음'}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full text-white" style={{ background: 'var(--purple)' }}>수락</button>
                      <button onClick={() => rejectFriend(req.id)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--bg)', color: 'var(--muted)', border: '1px solid rgba(108,92,231,0.15)' }}>거절</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(108,92,231,0.1)' }}>
              <p className="text-xs font-medium px-4 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>친구 {friendList.length}명</p>
              {friendList.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>아직 친구가 없어요</div>
              ) : (
                friendList.map((friend) => {
                  const fp = getFriendProfile(friend)
                  const fId = getFriendUserId(friend)
                  return (
                    <div key={friend.id} className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--surface)', borderTop: '1px solid rgba(108,92,231,0.05)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background: 'var(--purple)' }}>{fp?.nickname?.[0] || '?'}</div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{fp?.nickname || '알 수 없음'}</span>
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