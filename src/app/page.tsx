import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeClient from '@/components/HomeClient'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const { data: friends } = await supabase
    .from('kyorangtalk_friends')
    .select(`
      *,
      requester:requester_id(
        id,
        kyorangtalk_profiles(nickname)
      ),
      receiver:receiver_id(
        id,
        kyorangtalk_profiles(nickname)
      )
    `)
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted')

  const { data: pending } = await supabase
    .from('kyorangtalk_friends')
    .select(`
      *,
      requester:requester_id(
        id,
        kyorangtalk_profiles(nickname)
      )
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  const { data: rooms } = await supabase
    .from('kyorangtalk_rooms')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })

  return (
    <HomeClient
      userId={user.id}
      profile={profile}
      friends={friends || []}
      pending={pending || []}
      rooms={rooms || []}
    />
  )
}