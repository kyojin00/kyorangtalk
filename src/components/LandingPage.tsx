'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 배경 파티클 애니메이션
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: { x: number; y: number; r: number; dx: number; dy: number; opacity: number }[] = []
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.4 + 0.1,
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(167, 139, 250, ${p.opacity})`
        ctx.fill()
        p.x += p.dx
        p.y += p.dy
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1
      })
      // 연결선
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 120) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.15 * (1 - d / 120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const features = [
    { icon: '💬', title: '실시간 1:1 채팅', desc: '친구와 빠르고 안전하게 대화해요' },
    { icon: '👥', title: '그룹 채팅', desc: '친구들과 함께하는 단체 채팅방' },
    { icon: '🌐', title: '오픈 채팅', desc: '관심사가 같은 사람들을 만나보세요' },
    { icon: '📷', title: '이미지 공유', desc: '사진을 간편하게 전송해요' },
    { icon: '🔔', title: '실시간 알림', desc: '새 메시지를 놓치지 마세요' },
    { icon: '🌙', title: '다크/라이트 모드', desc: '눈에 편한 테마를 선택하세요' },
  ]

  return (
    <div style={{ background: '#080810', minHeight: '100vh', color: '#e2d9f3', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", overflowX: 'hidden', position: 'relative' }}>
      {/* 배경 캔버스 */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

      {/* 배경 그라디언트 오브 */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* 네비게이션 */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💬</div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px', color: '#fff' }}>교랑톡</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push('/login')}
            style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#c4b8d4', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
            로그인
          </button>
          <button onClick={() => router.push('/login')}
            style={{ padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
            시작하기
          </button>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '100px 24px 80px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 100,
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', marginBottom: 32,
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'all 0.6s ease',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>교랑 플랫폼의 새로운 채팅 서비스</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px',
          marginBottom: 24, color: '#fff',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          연결되는 순간,<br />
          <span style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            대화가 시작돼요
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: '#9b8fa8', lineHeight: 1.7, marginBottom: 40, maxWidth: 500, margin: '0 auto 40px',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.2s',
        }}>
          친구와 1:1 채팅, 그룹 대화, 관심사별 오픈방까지.<br />
          교랑톡과 함께 더 가까워지세요.
        </p>

        <div style={{
          display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s ease 0.3s',
        }}>
          <button onClick={() => router.push('/login')}
            style={{ padding: '14px 32px', borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(124,58,237,0.4)', transition: 'transform 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'translateY(-2px)'; (e.target as HTMLElement).style.boxShadow = '0 12px 40px rgba(124,58,237,0.5)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'translateY(0)'; (e.target as HTMLElement).style.boxShadow = '0 8px 32px rgba(124,58,237,0.4)' }}>
            무료로 시작하기 →
          </button>
          <button onClick={() => router.push('/login')}
            style={{ padding: '14px 32px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#c4b8d4', fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}>
            로그인
          </button>
        </div>
      </section>

      {/* 채팅 미리보기 UI */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 900, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{
          borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.15)',
          opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.97)',
          transition: 'all 0.8s ease 0.4s',
        }}>
          {/* 윈도우 상단바 */}
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>talk.kyorang.com</span>
          </div>
          {/* 채팅 UI 미리보기 */}
          <div style={{ display: 'flex', height: 360 }}>
            {/* 사이드바 */}
            <div style={{ width: 200, background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { name: '민승', msg: '오늘 뭐해?', time: '오후 2:30', unread: 2 },
                { name: '지수', msg: '사진 봤어?', time: '오후 1:15', unread: 0 },
                { name: '개발 스터디', msg: '📷 이미지', time: '오전 11:20', unread: 5 },
                { name: '맛집 탐방', msg: '여기 진짜 맛있다', time: '어제', unread: 0 },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 10, background: i === 0 ? 'rgba(124,58,237,0.2)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${i * 60 + 250}, 60%, 55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {item.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#e2d9f3' }}>{item.name}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{item.time}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.msg}</span>
                      {item.unread > 0 && <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{item.unread}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* 채팅창 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'hsl(250, 60%, 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>민</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e2d9f3' }}>민승</span>
                <span style={{ fontSize: 11, color: '#22c55e', marginLeft: 4 }}>● 온라인</span>
              </div>
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                {[
                  { me: false, text: '오늘 뭐해? 같이 공부할래?' },
                  { me: true, text: '좋아! 몇 시에?' },
                  { me: false, text: '3시 어때? 카페 가자' },
                  { me: true, text: '👍 ㅇㅋ!' },
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.me ? 'flex-end' : 'flex-start' }}>
                    <div style={{ padding: '8px 12px', borderRadius: m.me ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.me ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, maxWidth: '70%' }}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>메시지 입력...</div>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>→</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 섹션 */}
      <section style={{ position: 'relative', zIndex: 10, maxWidth: 960, margin: '0 auto 100px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1px', color: '#fff', marginBottom: 12 }}>
            필요한 모든 것이 <span style={{ color: '#a78bfa' }}>한 곳에</span>
          </h2>
          <p style={{ fontSize: 16, color: '#6b5e7e' }}>교랑톡의 다양한 기능을 경험해보세요</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: '24px', borderRadius: 18, background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)', transition: 'all 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.08)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.25)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e2d9f3', marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#6b5e7e', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA 섹션 */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '80px 24px 100px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 40px', borderRadius: 28, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-1px', position: 'relative' }}>
            지금 바로 시작해보세요
          </h2>
          <p style={{ fontSize: 16, color: '#9b8fa8', marginBottom: 32, position: 'relative' }}>
            무료로 가입하고 교랑톡의 모든 기능을 사용해보세요
          </p>
          <button onClick={() => router.push('/login')}
            style={{ padding: '14px 40px', borderRadius: 14, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', border: 'none', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 32px rgba(124,58,237,0.4)', position: 'relative', transition: 'all 0.2s' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.03)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)' }}>
            무료로 시작하기 →
          </button>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>💬</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#6b5e7e' }}>교랑톡</span>
        </div>
        <p style={{ fontSize: 13, color: '#4a3d5e' }}>© 2025 교랑 · All rights reserved</p>
        <div style={{ display: 'flex', gap: 20 }}>
          <a href="https://kyorang.ai.kr" style={{ fontSize: 13, color: '#6b5e7e', textDecoration: 'none' }}>교랑.ai.kr</a>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}