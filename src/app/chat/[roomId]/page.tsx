import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChatRoom from '@/components/ChatRoom'

export default async function ChatPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: room, error } = await supabase
    .from('kyorangtalk_rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  console.log('room:', JSON.stringify(room), 'error:', error?.message, 'userId:', user.id)

  if (error || !room) redirect('/')

  const isMyRoom = room.user1_id === user.id || room.user2_id === user.id
  console.log('isMyRoom:', isMyRoom, 'user1_id:', room.user1_id, 'user2_id:', room.user2_id)

  if (!isMyRoom) redirect('/')

  const { data: messages } = await supabase
    .from('kyorangtalk_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })

  const myNickname = room.user1_id === user.id ? room.user1_nickname : room.user2_nickname
  const partnerNickname = room.user1_id === user.id ? room.user2_nickname : room.user1_nickname

  return (
    <ChatRoom
      room={room}
      initialMessages={messages || []}
      userId={user.id}
      myNickname={myNickname}
      partnerNickname={partnerNickname}
    />
  )
}