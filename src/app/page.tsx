import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatListClient from '@/components/ChatListClient'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  console.log('user id:', user?.id, 'error:', error?.message)

  if (!user) redirect('/login')

  const { data: rooms } = await supabase
    .from('kyorangtalk_rooms')
    .select('*')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .neq('status', 'waiting')
    .order('updated_at', { ascending: false })

  return <ChatListClient initialRooms={rooms || []} userId={user.id} />
}