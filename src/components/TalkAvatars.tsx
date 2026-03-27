import Image from 'next/image'
import { Profile } from './types'

export function Avatar({ p, size = 40 }: { p: Profile | null | undefined; size?: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
        fontSize: size * 0.38, position: 'relative', color: 'white',
      }}
    >
      {p?.avatar_url
        ? <Image src={p.avatar_url} alt="" fill style={{ objectFit: 'cover' }} />
        : <span>{p?.nickname?.[0] || '?'}</span>
      }
    </div>
  )
}

export function GroupAvatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
        fontSize: size * 0.38, color: 'white',
      }}
    >
      {name?.[0] || '?'}
    </div>
  )
}
