export interface Profile {
  id: string
  nickname: string
  avatar_url?: string | null
  status_message?: string | null
}

export interface Friend {
  id: string
  requester_id: string
  receiver_id: string
  status: string
}

export interface Room {
  id: string
  user1_id: string
  user2_id: string
  last_message: string | null
  last_message_at: string | null
}

export interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean
}

export interface GroupRoom {
  id: string
  name: string
  description: string | null
  created_by: string
  invite_code: string
  is_public: boolean
  is_friend_group: boolean
  member_count: number
}

export interface GroupMessage {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
  msg_type: 'message' | 'system'
}

export interface GroupMember {
  id: string
  room_id: string
  user_id: string
  role: string
}

export interface OpenChat {
  id: string
  type: 'dm' | 'group'
  room?: Room
  groupRoom?: GroupRoom
}