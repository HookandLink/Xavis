'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Milestone, Task, NewTask, TaskCategory, EnergyCost, ContextType } from '@/types'

const CONTEXT_TYPE_OPTIONS: ContextType[] = [
  'book', 'KAL', 'habit', 'exercise',
  'major_study', 'sub_study', 'meeting', 'assignment',
]

const IMPORTANCE_LABELS = ['', '★', '★★', '★★★', '★★★★', '★★★★★']

const ENERGY_COLOR: Record<string, string> = {
  low: 'var(--neon)',
  mid: 'var(--warning)',
  high: 'var(--danger)',
}

function autoSchedule(tasks: Task[], deadline: string | null): Record<string, string> {
  const todo = tasks.filter((t) => t.status === 'todo' && !t.scheduled_date)
  if (todo.length === 0) return {}
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = deadline ? new Date(deadline + 'T00:00:00') : new Date(today)
  if (!deadline) end.setDate(end.getDate() + todo.length)
  const dates: string[] = []
  const cur = new Date(today)
  while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  if (dates.length === 0) dates.push(today.toISOString().split('T')[0])
  const sorted = [...todo].sort((a, b) => {
    const order = { must: 0, nice: 1, optional: 2 }
    return (order[a.category] ?? 1) - (order[b.category] ?? 1)
  })
  const result: Record<string, string> = {}
  sorted.forEach((task, i) => { result[task.id] = dates[i % dates.length] })
  return result
}

const CAT_CLASS: Record<string, string> = {
  must: 'classify-task', nice: 'classify-idea', optional: 'classify-note',
}

export default function MilestoneDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const milestoneId = params.milestoneId as string

  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [projectDeadline, setProjectDeadline] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<string | null>(null)

  const defaultForm: Omit<NewTask, 'milestone_id'> = {
    title: '', category: 'must', importance: 3, estimated_min: undefined,
    energy_cost: 'mid', context_type: 'major_study', scheduled_date: '', due_date: '',
  }
  const [form, setForm] = useState(defaultForm)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: mile }, { data: taskData }] = await Promise.all([
      supabase.from('milestones').select('*').eq('id', milestoneId).single(),
      supabase.from('tasks').select('*').eq('milestone_id', milestoneId).order('created_at', { ascending: true }),
    ])
    if (mile) {
      setMilestone(mile)
      const { data: proj } = await supabase.from('projects').select('deadline').eq('id', projectId).single()
      setProjectDeadline(proj?.deadline ?? null)
    }
    if (taskData) setTasks(taskData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [milestoneId])

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    fetchData()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    await supabase.from('tasks').insert([{
      milestone_id: milestoneId, title: form.title.trim(), category: form.category,
      importance: form.importance, estimated_min: form.estimated_min || null,
      energy_cost: form.energy_cost, context_type: form.context_type,
      scheduled_date: form.scheduled_date || null, due_date: form.due_date || null, status: 'todo',
    }])
    setForm(defaultForm); setShowForm(false); fetchData(); setSubmitting(false)
  }

  const handleDecompose = async () => {
    if (!aiDesc.trim()) return
    setAiLoading(true); setAiError(null)
    const res = await fetch('/api/decompose', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneTitle: milestone?.title, description: aiDesc, deadline: milestone?.due_date ?? projectDeadline }),
    })
    const data = await res.json()
    if (!res.ok || !data.tasks) { setAiError(data.error ?? 'AI 분해 실패'); setAiLoading(false); return }
    const rows = data.tasks.map((t: Omit<NewTask, 'milestone_id'>) => ({
      milestone_id: milestoneId, title: t.title, category: t.category ?? 'must',
      importance: t.importance ?? 3, estimated_min: t.estimated_min ?? null,
      energy_cost: t.energy_cost ?? 'mid', context_type: t.context_type ?? 'major_study', status: 'todo',
    }))
    await supabase.from('tasks').insert(rows)
    setAiDesc(''); setShowAI(false); fetchData(); setAiLoading(false)
  }

  const handleAutoSchedule = async () => {
    setScheduling(true); setScheduleResult(null)
    const deadline = milestone?.due_date ?? projectDeadline
    const assignments = autoSchedule(tasks, deadline)
    if (Object.keys(assignments).length === 0) {
      setScheduleResult('No tasks to schedule.'); setScheduling(false); return
    }
    await Promise.all(Object.entries(assignments).map(([id, date]) =>
      supabase.from('tasks').update({ scheduled_date: date }).eq('id', id)
    ))
    setScheduleResult(`${Object.keys(assignments).length} tasks scheduled.`)
    fetchData(); setScheduling(false)
  }

  if (loading) return <div className="fade-in metric-label" style={{ paddingTop: 20 }}>Loading...</div>
  if (!milestone) return (
    <div className="fade-in">
      <p style={{ color: 'var(--danger)', fontSize: 12 }}>마일스톤을 찾을 수 없습니다.</p>
      <Link href={`/projects/${projectId}`} style={{ color: 'var(--neon)', fontSize: 11 }}>← Project</Link>
    </div>
  )

  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <Link href={`/projects/${projectId}`} className="metric-label" style={{ display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.1em' }}>← PROJECT</Link>
          <div className="page-title">{milestone.title}</div>
          <div className="page-subtitle">
            {milestone.due_date ? `DUE: ${milestone.due_date} · ` : ''}
            {doneTasks}/{tasks.length} DONE
          </div>
        </div>
        <button className="btn btn-neon" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Task'}
        </button>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="metric-card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="metric-label" style={{ marginBottom: 0 }}>Progress</div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--neon)' }}>{pct}%</span>
          </div>
          <div className="progress-track" style={{ marginTop: 0 }}>
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* AI Tools Panel */}
      <div className="glass-card" style={{ marginBottom: 20 }}>
        <div className="metric-label" style={{ marginBottom: 12 }}>AI Tools</div>

        {/* AI Decompose */}
        <div>
          <button onClick={() => { setShowAI(!showAI); setAiError(null) }}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>✦ AI Auto-Decompose Tasks</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{showAI ? '▲' : '▼'}</span>
          </button>
          {showAI && (
            <div style={{ marginTop: 10 }}>
              <textarea className="x-textarea" value={aiDesc} onChange={e => setAiDesc(e.target.value)}
                placeholder={`Describe what needs to be done for "${milestone.title}"...`} rows={3} />
              {aiError && <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4 }}>⚠ {aiError}</p>}
              <button onClick={handleDecompose} disabled={aiLoading || !aiDesc.trim()}
                className="btn btn-neon" style={{ width: '100%', marginTop: 8 }}>
                {aiLoading ? 'Analyzing...' : 'Generate Tasks'}
              </button>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: 'var(--glass-border)', margin: '12px 0' }} />

        {/* Auto Schedule */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>Auto-Schedule Tasks</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {milestone.due_date ?? projectDeadline
                ? `Until ${milestone.due_date ?? projectDeadline}`
                : 'No deadline — spread by task count'}
            </div>
          </div>
          <button onClick={handleAutoSchedule} disabled={scheduling}
            className="btn btn-ghost" style={{ fontSize: 9 }}>
            {scheduling ? '...' : 'Run'}
          </button>
        </div>
        {scheduleResult && <p style={{ fontSize: 10, color: 'var(--neon)', marginTop: 6 }}>{scheduleResult}</p>}
      </div>

      {/* New Task Form */}
      {showForm && (
        <div className="x-form" style={{ marginBottom: 20 }}>
          <div className="x-form-title">New Task</div>
          <form onSubmit={handleSubmit}>
            <div className="x-form-field">
              <label className="x-label">Title *</label>
              <input className="x-input" type="text" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Task name" required />
            </div>
            <div className="x-form-grid">
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Category</label>
                <select className="x-select" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value as TaskCategory })}>
                  <option value="must">must</option>
                  <option value="nice">nice</option>
                  <option value="optional">optional</option>
                </select>
              </div>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Importance</label>
                <select className="x-select" value={form.importance}
                  onChange={e => setForm({ ...form, importance: Number(e.target.value) })}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{IMPORTANCE_LABELS[n]}</option>)}
                </select>
              </div>
            </div>
            <div className="x-form-grid" style={{ marginTop: 12 }}>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Energy Cost</label>
                <select className="x-select" value={form.energy_cost}
                  onChange={e => setForm({ ...form, energy_cost: e.target.value as EnergyCost })}>
                  <option value="low">low</option>
                  <option value="mid">mid</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Context</label>
                <select className="x-select" value={form.context_type}
                  onChange={e => setForm({ ...form, context_type: e.target.value as ContextType })}>
                  {CONTEXT_TYPE_OPTIONS.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
              </div>
            </div>
            <div className="x-form-field" style={{ marginTop: 12 }}>
              <label className="x-label">Estimated Time (min)</label>
              <input className="x-input" type="number" value={form.estimated_min ?? ''}
                onChange={e => setForm({ ...form, estimated_min: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="e.g. 30" min={1} />
            </div>
            <div className="x-form-grid">
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Scheduled Date</label>
                <input className="x-input" type="date" value={form.scheduled_date ?? ''}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Due Date</label>
                <input className="x-input" type="date" value={form.due_date ?? ''}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn btn-neon" disabled={submitting} style={{ width: '100%', marginTop: 12 }}>
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </form>
        </div>
      )}

      {/* Task List */}
      <div className="metric-label" style={{ marginBottom: 10 }}>Tasks · {tasks.length}</div>
      {tasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No tasks yet.</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Use AI decompose or add manually.</div>
        </div>
      ) : (
        tasks.map(task => (
          <div key={task.id} className="task-item" style={{ opacity: task.status === 'done' ? 0.55 : 1, cursor: 'pointer', marginBottom: 6 }}
            onClick={() => toggleTaskStatus(task)}>
            <div className={`task-check ${task.status === 'done' ? 'done' : ''}`}>
              {task.status === 'done' && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#00FFA3" strokeWidth="2">
                  <path d="M1.5 4l2 2 3-3"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={`task-name ${task.status === 'done' ? 'done' : ''}`}>{task.title}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                <span className={`inbox-classify ${CAT_CLASS[task.category] ?? 'classify-note'}`}
                  style={{ fontSize: 8, padding: '1px 6px' }}>
                  {task.category}
                </span>
                <span style={{ fontSize: 9, color: ENERGY_COLOR[task.energy_cost] }}>{task.energy_cost}</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{task.context_type}</span>
                {task.estimated_min && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{task.estimated_min}m</span>}
                {task.scheduled_date && <span style={{ fontSize: 9, color: 'var(--neon)' }}>{task.scheduled_date}</span>}
              </div>
            </div>
            <span style={{ fontSize: 9, color: 'var(--warning)', flexShrink: 0 }}>{IMPORTANCE_LABELS[task.importance]}</span>
          </div>
        ))
      )}
    </div>
  )
}
