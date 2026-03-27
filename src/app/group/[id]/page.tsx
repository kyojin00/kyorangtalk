import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import GroupChatClient from '@/components/GroupChatClient'

export default async function GroupChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 멤버 확인
  const { data: member } = await supabase
    .from('kyorangtalk_group_members')
    .select('*')
    .eq('room_id', id)
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/')

  const { data: room } = await supabase
    .from('kyorangtalk_group_rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (!room) notFound()

  const { data: messages } = await supabase
    .from('kyorangtalk_group_messages')
    .select('*')
    .eq('room_id', id)
    .order('created_at', { ascending: true })

  const { data: members } = await supabase
    .from('kyorangtalk_group_members')
    .select('*')
    .eq('room_id', id)

  const memberIds = (members ?? []).map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .in('id', memberIds)

  const profileMap: Record<string, any> = {}
  ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })

  const { data: myProfile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <GroupChatClient
      userId={user.id}
      myProfile={myProfile}
      room={room}
      initialMessages={messages ?? []}
      members={members ?? []}
      profileMap={profileMap}
    />
  )
}