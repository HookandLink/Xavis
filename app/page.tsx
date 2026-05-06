// app/page.tsx
// Xavis 홈 — 각 주요 기능으로 이동하는 네비게이션

import Link from 'next/link'

const NAV_ITEMS = [
  {
    href: '/projects',
    emoji: '📁',
    title: 'Projects',
    desc: '프로젝트 · 마일스톤 · 태스크 관리',
    ready: true,
  },
  {
    href: '/today',
    emoji: '☀️',
    title: 'Today',
    desc: '오늘 할 일 자동 계산',
    ready: true,
  },
  {
    href: '/daily-log',
    emoji: '📊',
    title: 'Daily Log',
    desc: '컨디션 체크인',
    ready: true,
  },
  {
    href: '/inbox',
    emoji: '📥',
    title: 'Inbox',
    desc: '자유 입력 → AI 자동 분류',
    ready: true,
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">Xavis</h1>
          <p className="text-gray-500 text-sm mt-2">나만의 AI 플래너</p>
        </div>

        {/* 메뉴 */}
        <ul className="space-y-3">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              {item.ready ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 transition"
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-4 bg-gray-900/50 border border-gray-800/50 rounded-xl p-4 opacity-40 cursor-not-allowed">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-gray-500 text-xs">{item.desc}</p>
                  </div>
                  <span className="ml-auto text-xs text-gray-600">준비 중</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
