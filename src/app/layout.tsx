import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '교랑톡 - 익명 1:1 채팅',
  description: '교랑이가 연결해주는 익명 채팅. 비슷한 고민을 가진 누군가와 대화해보세요.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}