'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProjectMode } from '@/types'

interface DailyLog {
  id: string; date: string; energy_level: number; focus_level: number
  mode: ProjectMode; tasks_done: number; note: string | null; created_at: string
}
interface LogForm { energy_level: number; focus_level: number; mode: ProjectMode; note: string }

const ENERGY_EMOJI = ['😴','😕','😐','🙂','⚡']
const FOCUS_EMOJI  = ['💭','😵','🙂','🎯','⚡']
const ENERGY_LABEL = ['최악','낮음','보통','좋음','최고']
const FOCUS_LABEL  = ['최악','낮음','보통','좋음','최고']

function getTodayLabel() {
  const d = new Date()
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

function calcStreak(logs: DailyLog[], today: string): number {
  const dates = new Set(logs.map(l => l.date))
  let streak = 0
  const cur = new Date(today + 'T00:00:00')
  while (true) {
    const d = cur.toISOString().split('T')[0]
    if (!dates.has(d)) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  return days[dt.getDay()]
}

export default function DailyLogPage() {
  const today = new Date().toISOString().split('T')[0]
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [history, setHistory] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<LogForm>({ energy_level: 3, focus_level: 3, mode: 'normal', note: '' })

  const countDoneTasks = useCallback(async () => {
    const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today).eq('status', 'done')
    return count ?? 0
  }, [today])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: todayData }, { data: histData }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('date', today).maybeSingle(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(30),
    ])
    if (todayData) {
      setTodayLog(todayData)
      setForm({ energy_level: todayData.energy_level, focus_level: todayData.focus_level, mode: todayData.mode, note: todayData.note ?? '' })
    }
    if (histData) setHistory(histData)
    setLoading(false)
  }, [today])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setSubmitError(null)
    const tasks_done = await countDoneTasks()
    if (todayLog) {
      const { error } = await supabase.from('daily_logs').update({
        energy_level: form.energy_level, focus_level: form.focus_level,
        mode: form.mode, note: form.note.trim() || null, tasks_done,
      }).eq('id', todayLog.id)
      if (error) setSubmitError(error.message)
      else { setIsEditing(false); fetchData() }
    } else {
      const { error } = await supabase.from('daily_logs').insert([{
        date: today, energy_level: form.energy_level, focus_level: form.focus_level,
        mode: form.mode, note: form.note.trim() || null, tasks_done,
      }])
      if (error) setSubmitError(error.message)
      else fetchData()
    }
    setSubmitting(false)
  }

  const allLogs = [todayLog, ...history.filter(l => l.date !== today)].filter(Boolean) as DailyLog[]
  const streak = calcStreak(allLogs, today)
  const last7 = history.filter(l => l.date !== today).slice(0, 6).reverse()
  const showForm = !todayLog || isEditing

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Daily Log</div>
          <div className="page-subtitle">{getTodayLabel()} · STREAK: {streak} DAYS</div>
        </div>
      </div>

      {loading ? <div className="metric-label" style={{ paddingTop: 20 }}>Loading...</div> : (
        <>
          {/* Today's log summary */}
          {todayLog && !isEditing && (
            <div className="glass-card neon-accent" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="metric-label" style={{ marginBottom: 0 }}>Today&apos;s Check-in</span>
                <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 9 }} onClick={() => setIsEditing(true)}>Edit</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div className="metric-label">Energy</div>
                  <div style={{ fontSize: 28 }}>{ENERGY_EMOJI[todayLog.energy_level - 1]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Lv.{todayLog.energy_level} — {ENERGY_LABEL[todayLog.energy_level - 1]}</div>
                </div>
                <div>
                  <div className="metric-label">Focus</div>
                  <div style={{ fontSize: 28 }}>{FOCUS_EMOJI[todayLog.focus_level - 1]}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Lv.{todayLog.focus_level} — {FOCUS_LABEL[todayLog.focus_level - 1]}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 9, color: 'var(--text-secondary)' }}>
                <span>Mode: <span style={{ color: todayLog.mode === 'exam' ? 'var(--danger)' : 'var(--text-primary)' }}>{todayLog.mode}</span></span>
                <span>Tasks Done: <span style={{ color: 'var(--text-primary)' }}>{todayLog.tasks_done}</span></span>
              </div>
              {todayLog.note && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-primary)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', lineHeight: 1.6 }}>
                  {todayLog.note}
                </div>
              )}
            </div>
          )}

          {/* Check-in Form */}
          {showForm && (
            <div className="x-form" style={{ marginBottom: 20 }}>
              <div className="x-form-title">{todayLog ? 'Edit Check-in' : 'Today\'s Check-in'}</div>
              <form onSubmit={handleSubmit}>
                <div className="x-form-field">
                  <label className="x-label">Energy Level {ENERGY_EMOJI[form.energy_level - 1]}</label>
                  <div className="condition-scale">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" className={`condition-btn ${form.energy_level === n ? 'selected' : ''}`}
                        onClick={() => setForm({...form, energy_level: n})}>
                        <span className="emoji">{ENERGY_EMOJI[n-1]}</span>
                        <span className="label">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="x-form-field">
                  <label className="x-label">Focus Level {FOCUS_EMOJI[form.focus_level - 1]}</label>
                  <div className="condition-scale">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" className={`condition-btn ${form.focus_level === n ? 'selected' : ''}`}
                        onClick={() => setForm({...form, focus_level: n})}>
                        <span className="emoji">{FOCUS_EMOJI[n-1]}</span>
                        <span className="label">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="x-form-field">
                  <label className="x-label">Mode</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['normal','exam'] as ProjectMode[]).map(m => (
                      <button key={m} type="button" onClick={() => setForm({...form, mode: m})}
                        className={`btn ${form.mode === m ? (m === 'exam' ? 'btn-danger' : 'btn-neon') : 'btn-ghost'}`}
                        style={{ flex: 1 }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="x-form-field">
                  <label className="x-label">Note</label>
                  <textarea className="x-textarea" rows={2} value={form.note}
                    onChange={e => setForm({...form, note: e.target.value})}
                    placeholder="오늘 하루를 한 줄로 기록하세요" />
                </div>
                {submitError && <div className="x-error">⚠ {submitError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  {isEditing && (
                    <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancel</button>
                  )}
                  <button type="submit" className="btn btn-neon" disabled={submitting} style={{ flex: 1 }}>
                    {submitting ? 'Saving...' : todayLog ? 'Update' : 'Check In'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Mini chart — last 7 days */}
          {last7.length > 0 && (
            <>
              <div className="metric-label" style={{ marginBottom: 12 }}>Last 7 Days</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 70, marginBottom: 20 }}>
                {last7.map(log => {
                  const h = (log.energy_level / 5) * 100
                  const isToday = log.date === today
                  return (
                    <div key={log.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', borderRadius: 3, height: `${h}%`, background: isToday ? 'rgba(0,255,163,0.3)' : 'var(--neon-dim)', border: `1px solid ${isToday ? 'rgba(0,255,163,0.6)' : 'rgba(0,255,163,0.2)'}`, boxShadow: isToday ? '0 0 8px rgba(0,255,163,0.2)' : 'none' }} />
                      <div style={{ fontSize: 8, color: isToday ? 'var(--neon)' : 'var(--text-muted)' }}>{fmtDate(log.date)}</div>
                    </div>
                  )
                })}
              </div>

              {/* History list */}
              <div className="metric-label" style={{ marginBottom: 10 }}>Recent Records</div>
              {last7.slice().reverse().map(log => (
                <div key={log.id} className="task-item" style={{ cursor: 'default', marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 60, flexShrink: 0 }}>{log.date.slice(5)}</span>
                  <span style={{ fontSize: 16 }}>{ENERGY_EMOJI[log.energy_level - 1]}</span>
                  <span style={{ fontSize: 16 }}>{FOCUS_EMOJI[log.focus_level - 1]}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.note ?? ''}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>✓ {log.tasks_done}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}
