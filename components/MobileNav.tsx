'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Home', emoji: '⌂' },
  { href: '/projects', label: 'Projects', emoji: '▦' },
  { href: '/today', label: 'Today', emoji: '◷' },
  { href: '/daily-log', label: 'Log', emoji: '▤' },
  { href: '/inbox', label: 'Inbox', emoji: '✉' },
]

export default function MobileNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="mobile-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`mobile-nav-item ${isActive(item.href) ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">{item.emoji}</span>
          <span className="mobile-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
