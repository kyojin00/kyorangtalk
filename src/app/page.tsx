import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeClient from '@/components/HomeClient'
import LandingPage from '@/components/LandingPage'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 안 된 경우 → 랜딩페이지
  if (!user) return <LandingPage />

  const { data: profile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/setup')

  // 친구 목록 (accepted)
  const { data: friendsRaw } = await supabase
    .from('kyorangtalk_friends')
    .select('*')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted')

  // 받은 친구 요청 (pending)
  const { data: pendingRaw } = await supabase
    .from('kyorangtalk_friends')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  // 관련 유저 ID 모아서 프로필 한번에 조회
  const allUserIds = new Set<string>()
  friendsRaw?.forEach(f => {
    allUserIds.add(f.requester_id)
    allUserIds.add(f.receiver_id)
  })
  pendingRaw?.forEach(f => allUserIds.add(f.requester_id))
  allUserIds.delete(user.id)

  const { data: profiles } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .in('id', Array.from(allUserIds))

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const { data: rooms } = await supabase
    .from('kyorangtalk_rooms')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })

  return (
    <HomeClient
      userId={user.id}
      profile={profile}
      friends={friendsRaw || []}
      pending={pendingRaw || []}
      rooms={rooms || []}
      profileMap={profileMap}
    />
  )
}