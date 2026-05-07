'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface HomeMetrics {
  todayDone: number
  todayTotal: number
  activeProjects: number
  atRiskProjects: number
  energyLevel: number | null
  inboxPending: number
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning.'
  if (h < 18) return 'Good afternoon.'
  return 'Good evening.'
}

function getTodayStr() {
  const d = new Date()
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}

export default function HomePage() {
  const today = new Date().toISOString().split('T')[0]
  const [metrics, setMetrics] = useState<HomeMetrics>({
    todayDone: 0, todayTotal: 0,
    activeProjects: 0, atRiskProjects: 0,
    energyLevel: null, inboxPending: 0,
  })

  useEffect(() => {
    async function load() {
      const [
        { data: todayTasks },
        { data: projects },
        { data: todayLog },
        { count: inboxCount },
      ] = await Promise.all([
        supabase.from('tasks').select('status').eq('scheduled_date', today).neq('status', 'skip'),
        supabase.from('projects').select('id, deadline, importance').eq('status', 'active'),
        supabase.from('daily_logs').select('energy_level').eq('date', today).maybeSingle(),
        supabase.from('inbox_items').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])

      const todayDone = todayTasks?.filter(t => t.status === 'done').length ?? 0
      const todayTotal = todayTasks?.length ?? 0

      // at-risk: deadline within 7 days
      const now = new Date(); now.setHours(0,0,0,0)
      const atRisk = projects?.filter(p => {
        if (!p.deadline) return false
        const dl = new Date(p.deadline + 'T00:00:00')
        return (dl.getTime() - now.getTime()) / 86400000 <= 7
      }).length ?? 0

      setMetrics({
        todayDone,
        todayTotal,
        activeProjects: projects?.length ?? 0,
        atRiskProjects: atRisk,
        energyLevel: todayLog?.energy_level ?? null,
        inboxPending: inboxCount ?? 0,
      })
    }
    load()
  }, [today])

  const todayPct = metrics.todayTotal > 0 ? Math.round((metrics.todayDone / metrics.todayTotal) * 100) : 0
  const energyPct = metrics.energyLevel ? metrics.energyLevel * 20 : 0

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">{getGreeting()}</div>
          <div className="page-subtitle">
            {getTodayStr()} · {metrics.todayTotal - metrics.todayDone} TASKS REMAINING
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Today Progress</div>
          <div className="metric-value neon">{todayPct}%</div>
          <div className="metric-sub">{metrics.todayDone} / {metrics.todayTotal} done</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${todayPct}%` }} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active Projects</div>
          <div className={`metric-value ${metrics.atRiskProjects > 0 ? 'danger' : ''}`}>
            {metrics.activeProjects}
          </div>
          <div className="metric-sub">{metrics.atRiskProjects} at risk</div>
          <div className="progress-track">
            <div className="progress-fill danger" style={{ width: `${metrics.activeProjects > 0 ? (metrics.atRiskProjects / metrics.activeProjects) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Energy</div>
          <div className="metric-value">{metrics.energyLevel ? `${energyPct}%` : '--'}</div>
          <div className="metric-sub">{metrics.energyLevel ? 'Logged today' : 'Not checked in'}</div>
          <div className="progress-track">
            <div className="progress-fill warning" style={{ width: `${energyPct}%` }} />
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Inbox</div>
          <div className={`metric-value ${metrics.inboxPending > 0 ? 'danger' : ''}`}>
            {metrics.inboxPending}
          </div>
          <div className="metric-sub">Unclassified</div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.min(metrics.inboxPending * 15, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Nav Cards */}
      <div className="home-grid">
        <Link href="/projects" className="home-nav-card">
          <div className="home-card-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="5" height="5" rx="1"/>
              <rect x="9" y="2" width="5" height="5" rx="1"/>
              <rect x="2" y="9" width="5" height="5" rx="1"/>
              <rect x="9" y="9" width="5" height="5" rx="1"/>
            </svg>
          </div>
          <div className="home-card-title">Projects</div>
          <div className="home-card-meta">
            {metrics.activeProjects} ACTIVE · {metrics.atRiskProjects} AT RISK
          </div>
        </Link>
        <Link href="/today" className="home-nav-card">
          <div className="home-card-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
            </svg>
          </div>
          <div className="home-card-title">Today</div>
          <div className="home-card-meta">
            {metrics.todayTotal} TASKS · {metrics.todayDone} DONE
          </div>
        </Link>
        <Link href="/daily-log" className="home-nav-card">
          <div className="home-card-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3h10v10H3zM3 7h10M7 3v10"/>
            </svg>
          </div>
          <div className="home-card-title">Daily Log</div>
          <div className="home-card-meta">
            {metrics.energyLevel ? `ENERGY LV.${metrics.energyLevel}` : 'CHECK IN TODAY'}
          </div>
        </Link>
        <Link href="/inbox" className="home-nav-card">
          <div className="home-card-icon">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12v8H2zM2 4l6 5 6-5"/>
            </svg>
          </div>
          <div className="home-card-title">Inbox</div>
          <div className="home-card-meta">
            {metrics.inboxPending > 0 ? `${metrics.inboxPending} PENDING CLASSIFICATION` : 'ALL CLEAR'}
          </div>
        </Link>
      </div>
    </div>
  )
}
