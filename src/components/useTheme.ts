export function useThemeColors(isDark: boolean) {
  return {
    bg: isDark ? '#0f0f14' : '#f7f4ff',
    surface: isDark ? '#1a1a24' : '#ffffff',
    sidebarBg: isDark ? '#13131a' : '#f0eeff',
    headerBg: isDark ? '#13131a' : '#f0eeff',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.1)',
    borderSub: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,92,231,0.06)',
    text: isDark ? '#e2d9f3' : '#2A2035',
    muted: isDark ? '#5a5a6e' : '#9B8FA8',
    label: isDark ? '#4a4a5e' : '#c4b8d4',
    accent: '#7c3aed',
    accentLight: isDark ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)',
    accentText: isDark ? '#a78bfa' : '#7c3aed',
    accentBorder: isDark ? 'rgba(124,58,237,0.3)' : 'rgba(124,58,237,0.2)',
    inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.05)',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(108,92,231,0.15)',
    myBubble: isDark ? '#6d28d9' : '#7c3aed',
    theirBubble: isDark ? '#1e1e2e' : '#ffffff',
    theirBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(108,92,231,0.12)',
    datePill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(108,92,231,0.07)',
  }
}

export function fmtTime(d: string) {
  const date = new Date(d), now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function fmtDate(d: string) {
  const date = new Date(d), now = new Date()
  const diff = new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()
  if (diff === 0) return '오늘'
  if (diff === 86400000) return '어제'
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

export function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export function isSameMin(a: string, b: string) {
  if (!isSameDay(a, b)) return false
  const da = new Date(a), db = new Date(b)
  return da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes()
}
