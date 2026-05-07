'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 6.5L8 2l6 4.5V14H2z"/>
      </svg>
    ),
  },
  {
    href: '/projects',
    label: 'Projects',
    icon: (
      <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="5" height="5" rx="1"/>
        <rect x="9" y="2" width="5" height="5" rx="1"/>
        <rect x="2" y="9" width="5" height="5" rx="1"/>
        <rect x="9" y="9" width="5" height="5" rx="1"/>
      </svg>
    ),
  },
  {
    href: '/today',
    label: 'Today',
    icon: (
      <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
      </svg>
    ),
  },
  {
    href: '/daily-log',
    label: 'Daily Log',
    icon: (
      <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3h10v10H3zM3 7h10M7 3v10"/>
      </svg>
    ),
  },
  {
    href: '/inbox',
    label: 'Inbox',
    icon: (
      <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12v8H2zM2 4l6 5 6-5"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="sidebar">
      {/* Logo */}
      <Link href="/" className="logo">
        <div className="logo-mark">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7h10M7 2l5 5-5 5"/>
          </svg>
        </div>
        <div>
          <div className="logo-text">XAVIS</div>
          <div className="logo-version">v2.0 · AI PLANNER</div>
        </div>
      </Link>

      {/* Nav */}
      <div className="nav-section">
        <div className="nav-label">Navigate</div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>

      {/* Footer status */}
      <div className="sidebar-footer">
        <div className="status-chip">
          <div className="status-dot" />
          <div className="status-text">System</div>
          <div className="status-val">Online</div>
        </div>
      </div>
    </nav>
  )
}
