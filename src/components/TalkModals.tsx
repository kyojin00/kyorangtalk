'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from './TalkAvatars'
import { useThemeColors } from './useTheme'
import { Profile, Friend, GroupRoom } from './types'

// 그룹 만들기 모달
export function CreateGroupModal({ userId, isDark, onClose, onCreated }: {
  userId: string
  isDark: boolean
  onClose: () => void
  onCreated: (room: GroupRoom) => void
}) {
  const supabase = createClient()
  const t = useThemeColors(isDark)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteResults, setInviteResults] = useState<Profile[]>([])
  const [invitedMembers, setInvitedMembers] = useState<Profile[]>([])
  const [creating, setCreating] = useState(false)

  const handleSearch = async () => {
    if (!inviteQuery.trim()) return
    const { data } = await supabase.from('kyorangtalk_profiles').select('*').ilike('nickname', `%${inviteQuery}%`).neq('id', userId).limit(10)
    setInviteResults(data || [])
  }

  const handleCreate = async () => {
    if (!groupName.trim()) return
    setCreating(true)
    const { data: room } = await supabase
      .from('kyorangtalk_group_rooms')
      .insert({
        name: groupName.trim(),
        description: groupDesc.trim() || null,
        created_by: userId,
        is_public: isPublic,
        is_friend_group: false,
        member_count: invitedMembers.length + 1,
      })
      .select().single()
    if (room) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'owner' })
      for (const m of invitedMembers) {
        await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: m.id, role: 'member' })
      }
      onCreated(room)
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-3xl p-6 w-full max-w-md mx-4 overflow-y-auto" style={{ background: t.surface, maxHeight: '90vh' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold" style={{ color: t.text }}>새 그룹 만들기</h3>
          <button onClick={onClose} style={{ color: t.muted }}>✕</button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="그룹 이름 *" value={groupName} onChange={e => setGroupName(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
          <textarea placeholder="그룹 설명 (선택)" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} rows={2}
            className="w-full text-sm rounded-xl px-4 py-3 outline-none resize-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}` }}>
            <div>
              <p className="text-sm font-medium" style={{ color: t.text }}>공개 그룹</p>
              <p className="text-xs" style={{ color: t.muted }}>탐색에서 발견 가능</p>
            </div>
            <button onClick={() => setIsPublic(p => !p)} className="w-11 h-6 rounded-full transition-all relative" style={{ background: isPublic ? t.accent : t.inputBorder }}>
              <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: isPublic ? '22px' : '2px' }} />
            </button>
          </div>
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: t.muted }}>멤버 초대 (선택)</p>
            <div className="flex gap-2">
              <input type="text" placeholder="닉네임 검색" value={inviteQuery} onChange={e => setInviteQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 text-sm rounded-xl px-4 py-2.5 outline-none" style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
              <button onClick={handleSearch} className="text-sm px-4 py-2.5 rounded-xl text-white" style={{ background: t.accent }}>검색</button>
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
          <button onClick={handleCreate} disabled={!groupName.trim() || creating} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: t.accent }}>
            {creating ? '만드는 중...' : '만들기'}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm" style={{ background: t.inputBg, color: t.muted }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// 새 채팅 모달 (친구 선택 → 1명이면 DM, 2명 이상이면 친구 그룹방)
export function CreateChatModal({ userId, profile, friendList, pMap, isDark, onClose, onStartDM, onStartGroup }: {
  userId: string
  profile: Profile
  friendList: Friend[]
  pMap: Record<string, Profile>
  isDark: boolean
  onClose: () => void
  onStartDM: (friendUserId: string) => void
  onStartGroup: (room: GroupRoom) => void
}) {
  const supabase = createClient()
  const t = useThemeColors(isDark)
  const [selected, setSelected] = useState<Profile[]>([])
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)

  const getFriendUserId = (f: Friend) => f.requester_id === userId ? f.receiver_id : f.requester_id

  const handleStart = async () => {
    if (selected.length === 0) return
    setCreating(true)

    if (selected.length === 1) {
      onStartDM(selected[0].id)
      onClose()
      setCreating(false)
      return
    }

    // 2명 이상 → 친구 그룹방 (is_friend_group: true, 초대링크 불필요)
    const name = roomName.trim() || `${profile.nickname}, ${selected.map(f => f.nickname).join(', ')}`
    const { data: room } = await supabase
      .from('kyorangtalk_group_rooms')
      .insert({
        name,
        created_by: userId,
        is_public: false,
        is_friend_group: true,
        member_count: selected.length + 1,
      })
      .select().single()
    if (room) {
      await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: userId, role: 'owner' })
      for (const f of selected) {
        await supabase.from('kyorangtalk_group_members').insert({ room_id: room.id, user_id: f.id, role: 'member' })
      }
      onStartGroup(room)
    }
    onClose()
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-3xl p-6 w-full max-w-sm mx-4" style={{ background: t.surface }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: t.text }}>새 채팅</h3>
          <button onClick={onClose} style={{ color: t.muted }}>✕</button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map(f => (
              <div key={f.id} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs" style={{ background: t.accentLight, color: t.accentText }}>
                {f.nickname}
                <button onClick={() => setSelected(prev => prev.filter(x => x.id !== f.id))}>✕</button>
              </div>
            ))}
          </div>
        )}

        {selected.length >= 2 && (
          <input type="text"
            placeholder={`방 이름 (기본: ${profile.nickname}, ${selected[0].nickname}...)`}
            value={roomName} onChange={e => setRoomName(e.target.value)}
            className="w-full text-sm rounded-xl px-4 py-2.5 outline-none mb-3"
            style={{ background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text }} />
        )}

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {friendList.length === 0
            ? <p className="text-center text-sm py-6" style={{ color: t.muted }}>친구가 없어요</p>
            : friendList.map(f => {
              const fId = getFriendUserId(f)
              const fp = pMap[fId]
              const isSelected = !!selected.find(x => x.id === fId)
              return (
                <button key={f.id}
                  onClick={() => { if (isSelected) setSelected(prev => prev.filter(x => x.id !== fId)); else if (fp) setSelected(prev => [...prev, fp]) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: isSelected ? t.accentLight : 'transparent' }}>
                  <Avatar p={fp} size={36} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium" style={{ color: t.text }}>{fp?.nickname || '알 수 없음'}</p>
                    {fp?.status_message && <p className="text-xs truncate" style={{ color: t.muted }}>{fp.status_message}</p>}
                  </div>
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: isSelected ? t.accent : t.inputBg, border: `1.5px solid ${isSelected ? t.accent : t.inputBorder}` }}>
                    {isSelected && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                  </div>
                </button>
              )
            })
          }
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={handleStart} disabled={selected.length === 0 || creating}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: t.accent }}>
            {creating ? '시작 중...' : selected.length === 1 ? '채팅 시작' : `${selected.length + 1}명 채팅 시작`}
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl text-sm" style={{ background: t.inputBg, color: t.muted }}>취소</button>
        </div>
      </div>
    </div>
  )
}