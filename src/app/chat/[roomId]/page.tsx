import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatRoom from '@/components/ChatRoom'

export default async function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: room } = await supabase
    .from('kyorangtalk_rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (!room) redirect('/')

  const isMyRoom = room.user1_id === user.id || room.user2_id === user.id
  if (!isMyRoom) redirect('/')

  const partnerId = room.user1_id === user.id ? room.user2_id : room.user1_id

  const { data: myProfile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: partnerProfile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', partnerId)
    .single()

  const { data: messages } = await supabase
    .from('kyorangtalk_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  return (
    <ChatRoom
      room={room}
      initialMessages={messages || []}
      userId={user.id}
      myProfile={myProfile || { id: user.id, nickname: '나', avatar_url: null, status_message: null }}
      partnerProfile={partnerProfile || { id: partnerId, nickname: '상대방', avatar_url: null, status_message: null }}
    />
  )
}