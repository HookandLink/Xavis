'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { NewProject, Project, ProjectMode } from '@/types'

const defaultForm: NewProject = { title: '', description: '', mode: 'normal', importance: 3, deadline: '' }

function getRiskLevel(project: Project, taskStats: Record<string, { total: number; done: number }>) {
  const stats = taskStats[project.id]
  if (!stats || stats.total === 0) return 'low'
  const completion = stats.done / stats.total
  if (!project.deadline) return completion < 0.3 ? 'mid' : 'low'
  const today = new Date(); today.setHours(0,0,0,0)
  const dl = new Date(project.deadline + 'T00:00:00')
  const days = Math.ceil((dl.getTime() - today.getTime()) / 86400000)
  const remaining = stats.total - stats.done
  if (days < 0) return 'high'
  if (days < remaining || (days <= 7 && completion < 0.5)) return 'high'
  if (days < remaining * 1.5 || (days <= 14 && completion < 0.3)) return 'mid'
  return 'low'
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [taskStats, setTaskStats] = useState<Record<string, { total: number; done: number }>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<NewProject>(defaultForm)

  const fetchProjects = async () => {
    setLoading(true)
    const { data: projects } = await supabase.from('projects').select('*').order('updated_at', { ascending: false })
    if (projects) {
      setProjects(projects)
      // fetch task stats for each project
      const { data: milestones } = await supabase.from('milestones').select('id, project_id').in('project_id', projects.map(p => p.id))
      if (milestones && milestones.length > 0) {
        const { data: tasks } = await supabase.from('tasks').select('id, status, milestone_id').in('milestone_id', milestones.map(m => m.id))
        const stats: Record<string, { total: number; done: number }> = {}
        projects.forEach(p => { stats[p.id] = { total: 0, done: 0 } })
        tasks?.forEach(t => {
          const ms = milestones.find(m => m.id === t.milestone_id)
          if (ms) {
            stats[ms.project_id].total++
            if (t.status === 'done') stats[ms.project_id].done++
          }
        })
        setTaskStats(stats)
      }
    }
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true); setSubmitError(null)
    const { error } = await supabase.from('projects').insert([{
      title: form.title.trim(),
      description: form.description?.trim() || null,
      mode: form.mode, importance: form.importance,
      deadline: form.deadline || null, status: 'active',
    }])
    if (!error) { setForm(defaultForm); setShowForm(false); fetchProjects() }
    else setSubmitError(error.message)
    setSubmitting(false)
  }

  const riskLabel = { high: 'High Risk', mid: 'Mid Risk', low: 'On Track' }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-subtitle">{projects.filter(p=>p.status==='active').length} ACTIVE</div>
        </div>
        <button className="btn btn-neon" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* New Project Form */}
      {showForm && (
        <div className="x-form" style={{ marginBottom: 20 }}>
          <div className="x-form-title">New Project</div>
          <form onSubmit={handleSubmit}>
            <div className="x-form-field">
              <label className="x-label">Title *</label>
              <input className="x-input" type="text" value={form.title}
                onChange={e => setForm({...form, title: e.target.value})} placeholder="Project name" required />
            </div>
            <div className="x-form-field">
              <label className="x-label">Description</label>
              <textarea className="x-textarea" rows={2} value={form.description ?? ''}
                onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional" />
            </div>
            <div className="x-form-grid">
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Mode</label>
                <select className="x-select" value={form.mode}
                  onChange={e => setForm({...form, mode: e.target.value as ProjectMode})}>
                  <option value="normal">normal</option>
                  <option value="exam">exam</option>
                </select>
              </div>
              <div className="x-form-field" style={{ marginBottom: 0 }}>
                <label className="x-label">Importance</label>
                <select className="x-select" value={form.importance}
                  onChange={e => setForm({...form, importance: Number(e.target.value)})}>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select>
              </div>
            </div>
            <div className="x-form-field" style={{ marginTop: 12 }}>
              <label className="x-label">Deadline</label>
              <input className="x-input" type="date" value={form.deadline ?? ''}
                onChange={e => setForm({...form, deadline: e.target.value})} />
            </div>
            {submitError && <div className="x-error">⚠ {submitError}</div>}
            <button type="submit" className="btn btn-neon" disabled={submitting} style={{ width: '100%', marginTop: 4 }}>
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="metric-label" style={{ paddingTop: 20 }}>Loading...</div>
      ) : projects.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No projects yet.</div>
        </div>
      ) : (
        projects.map(p => {
          const risk = getRiskLevel(p, taskStats)
          const stats = taskStats[p.id]
          const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className={`project-card ${risk === 'high' ? 'danger-accent' : risk === 'low' ? 'neon-accent' : ''}`}>
              <div className="project-card-header">
                <div>
                  <div className="project-name">{p.title}</div>
                  <div className="project-meta">
                    {stats && <span>{stats.total} TASKS</span>}
                    {p.deadline && <span>DUE: {p.deadline}</span>}
                    <span>{'★'.repeat(p.importance)}</span>
                    {p.mode === 'exam' && <span style={{ color: 'var(--danger)' }}>EXAM</span>}
                  </div>
                </div>
                <div className={`risk-badge risk-${risk}`}>{riskLabel[risk]}</div>
              </div>
              <div className="progress-track" style={{ marginTop: 0 }}>
                <div className={`progress-fill ${risk === 'high' ? 'danger' : risk === 'mid' ? 'warning' : ''}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{pct}% complete</span>
                {stats && <span style={{ fontSize: 9, color: risk === 'high' ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {stats.total - stats.done} remaining
                </span>}
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
