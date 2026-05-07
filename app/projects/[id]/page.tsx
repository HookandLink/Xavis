'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Milestone, NewMilestone } from '@/types'

interface RiskInfo {
  score: number
  level: '안전' | '주의' | '위험'
  daysRemaining: number | null
  totalTasks: number
  doneTasks: number
  todoTasks: number
}

function calcRisk(project: Project, totalTasks: number, doneTasks: number): RiskInfo {
  const todoTasks = totalTasks - doneTasks
  let score = 0
  let daysRemaining: number | null = null

  if (project.deadline) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dl = new Date(project.deadline + 'T00:00:00')
    daysRemaining = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysRemaining < 0) {
      score = 100
    } else {
      const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 1
      if (completionRate < 0.3) score += 25
      else if (completionRate < 0.6) score += 10
      if (daysRemaining < todoTasks) score += 35
      else if (daysRemaining < todoTasks * 1.5) score += 15
      if (daysRemaining <= 1) score += 25
      else if (daysRemaining <= 3) score += 15
      else if (daysRemaining <= 7) score += 5
      if (project.importance >= 4) score += 10
    }
  } else {
    const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 1
    if (completionRate < 0.2) score = 30
    else if (completionRate < 0.5) score = 15
  }

  score = Math.min(100, Math.max(0, score))
  const level = score >= 67 ? '위험' : score >= 34 ? '주의' : '안전'
  return { score, level, daysRemaining, totalTasks, doneTasks, todoTasks }
}

interface Advice { title: string; action: string; effect: string }

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [risk, setRisk] = useState<RiskInfo | null>(null)
  const [advice, setAdvice] = useState<Advice[] | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<NewMilestone, 'project_id'>>({ title: '', due_date: '', order_index: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: miles }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
    ])
    if (proj) {
      setProject(proj)
      const milestoneIds = (miles ?? []).map((m) => m.id)
      if (milestoneIds.length > 0) {
        const { data: taskData } = await supabase.from('tasks').select('id, status').in('milestone_id', milestoneIds)
        const total = taskData?.length ?? 0
        const done = taskData?.filter((t) => t.status === 'done').length ?? 0
        setRisk(calcRisk(proj, total, done))
      } else {
        setRisk(calcRisk(proj, 0, 0))
      }
    }
    if (miles) setMilestones(miles)
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setForm((prev) => ({ ...prev, order_index: milestones.length })) }, [milestones.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    await supabase.from('milestones').insert([{
      project_id: projectId, title: form.title.trim(),
      due_date: form.due_date || null, order_index: form.order_index, status: 'todo',
    }])
    setForm({ title: '', due_date: '', order_index: 0 })
    setShowForm(false)
    fetchData()
    setSubmitting(false)
  }

  const handleGetAdvice = async () => {
    if (!project || !risk) return
    setAdviceLoading(true); setAdviceError(null); setAdvice(null)
    const res = await fetch('/api/risk-advice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectTitle: project.title, deadline: project.deadline,
        daysRemaining: risk.daysRemaining, totalTasks: risk.totalTasks,
        doneTasks: risk.doneTasks, todoTasks: risk.todoTasks,
        riskScore: risk.score, riskLevel: risk.level,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.advice) setAdviceError(data.error ?? 'AI 응답 실패')
    else setAdvice(data.advice)
    setAdviceLoading(false)
  }

  if (loading) return <div className="fade-in metric-label" style={{ paddingTop: 20 }}>Loading...</div>
  if (!project) return (
    <div className="fade-in">
      <p style={{ color: 'var(--danger)', fontSize: 12 }}>프로젝트를 찾을 수 없습니다.</p>
      <Link href="/projects" style={{ color: 'var(--neon)', fontSize: 11 }}>← Projects</Link>
    </div>
  )

  const riskColor = risk ? (risk.score >= 67 ? 'var(--danger)' : risk.score >= 34 ? 'var(--warning)' : 'var(--neon)') : 'var(--neon)'
  const riskLabel = risk ? (risk.level === '위험' ? 'HIGH RISK' : risk.level === '주의' ? 'MID RISK' : 'ON TRACK') : ''

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <Link href="/projects" className="metric-label" style={{ display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.1em' }}>← PROJECTS</Link>
          <div className="page-title">{project.title}</div>
          <div className="page-subtitle">
            {project.deadline && `DUE: ${project.deadline} · `}
            {'★'.repeat(project.importance)}
            {project.mode === 'exam' && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>EXAM MODE</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Link href={`/projects/${projectId}/workflow`} className="btn btn-ghost" style={{ fontSize: 9 }}>
            WORKFLOW
          </Link>
          <button className="btn btn-neon" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Milestone'}
          </button>
        </div>
      </div>

      {project.description && (
        <div className="glass-card" style={{ marginBottom: 16, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {project.description}
        </div>
      )}

      {/* Risk Panel */}
      {risk && (
        <div className={`glass-card ${risk.score >= 67 ? 'danger-accent' : risk.score < 34 ? 'neon-accent' : ''}`} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="metric-label" style={{ marginBottom: 2 }}>Risk Analysis</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: riskColor }}>{riskLabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: riskColor, fontFamily: 'var(--font-display)' }}>{risk.score}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>SCORE</div>
            </div>
          </div>

          <div className="progress-track" style={{ marginBottom: 12 }}>
            <div className={`progress-fill ${risk.score >= 67 ? 'danger' : risk.score >= 34 ? 'warning' : ''}`}
              style={{ width: `${risk.score}%` }} />
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
            {risk.daysRemaining !== null && (
              <span style={{ color: risk.daysRemaining < 0 ? 'var(--danger)' : 'inherit' }}>
                {risk.daysRemaining < 0 ? `${Math.abs(risk.daysRemaining)}D OVERDUE` : `${risk.daysRemaining}D LEFT`}
              </span>
            )}
            <span>{risk.doneTasks}/{risk.totalTasks} DONE</span>
            <span>{risk.todoTasks} REMAINING</span>
          </div>

          {!advice && (
            <button onClick={handleGetAdvice} disabled={adviceLoading}
              className="btn btn-ghost" style={{ width: '100%', fontSize: 10 }}>
              {adviceLoading ? 'Analyzing...' : '✦ AI ALTERNATIVES'}
            </button>
          )}
          {adviceError && <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 6 }}>⚠ {adviceError}</p>}

          {advice && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="metric-label" style={{ marginBottom: 0 }}>AI Alternatives</div>
                <button onClick={() => setAdvice(null)} style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>CLOSE</button>
              </div>
              {advice.map((a, i) => (
                <div key={i} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{i + 1}. {a.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>{a.action}</div>
                  <div style={{ fontSize: 10, color: 'var(--neon)' }}>→ {a.effect}</div>
                </div>
              ))}
              <button onClick={handleGetAdvice} disabled={adviceLoading}
                style={{ fontSize: 9, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', marginTop: 4 }}>
                {adviceLoading ? 'Analyzing...' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Milestone Form */}
      {showForm && (
        <div className="x-form" style={{ marginBottom: 20 }}>
          <div className="x-form-title">New Milestone</div>
          <form onSubmit={handleSubmit}>
            <div className="x-form-field">
              <label className="x-label">Title *</label>
              <input className="x-input" type="text" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Milestone name" required />
            </div>
            <div className="x-form-grid">
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Due Date</label>
                <input className="x-input" type="date" value={form.due_date ?? ''}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Order</label>
                <input className="x-input" type="number" value={form.order_index} min={0}
                  onChange={e => setForm({ ...form, order_index: Number(e.target.value) })} />
              </div>
            </div>
            <button type="submit" className="btn btn-neon" disabled={submitting} style={{ width: '100%', marginTop: 12 }}>
              {submitting ? 'Creating...' : 'Create Milestone'}
            </button>
          </form>
        </div>
      )}

      {/* Milestones */}
      <div className="metric-label" style={{ marginBottom: 10 }}>Milestones · {milestones.length}</div>
      {milestones.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No milestones yet.</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.06em' }}>Add milestones to track your project.</div>
        </div>
      ) : (
        milestones.map((m) => (
          <Link key={m.id} href={`/projects/${projectId}/milestones/${m.id}`} className="task-item" style={{ display: 'flex', textDecoration: 'none', marginBottom: 6 }}>
            <div className={`inbox-classify ${m.status === 'done' ? 'classify-note' : m.status === 'active' ? 'classify-task' : ''}`}
              style={m.status === 'todo' ? { color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--glass-border)' } : {}}>
              {m.status.toUpperCase()}
            </div>
            <div className="inbox-text" style={{ textDecoration: m.status === 'done' ? 'line-through' : 'none', color: m.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {m.title}
            </div>
            {m.due_date && (
              <div style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0, letterSpacing: '0.06em' }}>{m.due_date}</div>
            )}
          </Link>
        ))
      )}
    </div>
  )
}
