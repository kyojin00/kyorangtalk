import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileClient from '@/components/ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('kyorangtalk_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/setup')

  return <ProfileClient profile={profile} userId={user.id} />
}