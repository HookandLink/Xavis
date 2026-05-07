'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Milestone, Task } from '@/types'

interface MilestoneWithTasks extends Milestone { tasks: Task[] }

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dl = new Date(deadline + 'T00:00:00')
  return Math.ceil((dl.getTime() - today.getTime()) / 86400000)
}

const CAT_CLASS: Record<string, string> = {
  must: 'classify-task', nice: 'classify-idea', optional: 'classify-note',
}

export default function WorkflowPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<MilestoneWithTasks[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: miles }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('order_index'),
    ])
    if (proj) setProject(proj)
    if (miles && miles.length > 0) {
      const { data: tasks } = await supabase.from('tasks').select('*')
        .in('milestone_id', miles.map(m => m.id)).order('created_at')
      const taskMap: Record<string, Task[]> = {}
      tasks?.forEach(t => {
        if (!taskMap[t.milestone_id]) taskMap[t.milestone_id] = []
        taskMap[t.milestone_id].push(t)
      })
      const merged: MilestoneWithTasks[] = miles.map(m => ({ ...m, tasks: taskMap[m.id] ?? [] }))
      setMilestones(merged)
      const activeIds = new Set(merged.filter(m => m.status === 'active').map(m => m.id))
      setExpanded(activeIds)
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <div className="fade-in metric-label" style={{ paddingTop: 20 }}>Loading...</div>
  if (!project) return <div className="fade-in"><p style={{ color: 'var(--danger)', fontSize: 12 }}>Project not found.</p></div>

  const allTasks = milestones.flatMap(m => m.tasks)
  const totalTasks = allTasks.length
  const doneTasks = allTasks.filter(t => t.status === 'done').length
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const dl = daysLeft(project.deadline ?? null)

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <Link href={`/projects/${projectId}`} className="metric-label" style={{ display: 'block', marginBottom: 4, fontSize: 9, letterSpacing: '0.1em' }}>← PROJECT</Link>
          <div className="page-title">Workflow</div>
          <div className="page-subtitle">{project.title}</div>
        </div>
      </div>

      {/* Project Summary */}
      <div className="metric-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--neon)' }}>{overallPct}%</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 10, letterSpacing: '0.08em' }}>
              {doneTasks} / {totalTasks} DONE
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            {project.deadline && (
              <div style={{ fontSize: 9, color: dl !== null && dl < 0 ? 'var(--danger)' : dl !== null && dl <= 7 ? 'var(--warning)' : 'var(--text-muted)', letterSpacing: '0.06em' }}>
                {project.deadline}{dl !== null && (dl < 0 ? ` · ${Math.abs(dl)}D OVERDUE` : ` · ${dl}D LEFT`)}
              </div>
            )}
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {milestones.length} MILESTONES · {totalTasks} TASKS
            </div>
          </div>
        </div>
        <div className="progress-track" style={{ marginTop: 0 }}>
          <div className="progress-fill" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* Timeline */}
      {milestones.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No milestones yet.</div>
        </div>
      ) : (
        <div>
          {milestones.map((m, idx) => {
            const mDone = m.tasks.filter(t => t.status === 'done').length
            const mTotal = m.tasks.length
            const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0
            const isExpanded = expanded.has(m.id)
            const isLast = idx === milestones.length - 1

            const statusColor = m.status === 'done' ? 'var(--neon)' : m.status === 'active' ? 'var(--warning)' : 'var(--text-muted)'

            return (
              <div key={m.id} style={{ display: 'flex', gap: 12, marginBottom: isLast ? 0 : 0 }}>
                {/* Timeline spine */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', marginTop: 14, flexShrink: 0,
                    background: statusColor, boxShadow: m.status !== 'todo' ? `0 0 8px ${statusColor}` : 'none',
                    border: `2px solid ${statusColor}`,
                  }} />
                  {!isLast && (
                    <div style={{
                      width: 1, flex: 1, marginTop: 4, marginBottom: 0,
                      background: m.status === 'done' ? 'rgba(0,255,163,0.3)' : 'var(--glass-border)',
                      minHeight: 24,
                    }} />
                  )}
                </div>

                {/* Milestone Card */}
                <div style={{ flex: 1, paddingBottom: 16 }}>
                  <button onClick={() => toggleExpand(m.id)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mTotal > 0 ? 6 : 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: m.status === 'done' ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: m.status === 'done' ? 'line-through' : 'none',
                      }}>
                        {m.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {m.due_date && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{fmtDate(m.due_date)}</span>}
                        <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    {mTotal > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-track" style={{ flex: 1, marginTop: 0 }}>
                          <div className={`progress-fill ${m.status === 'done' ? '' : ''}`}
                            style={{ width: `${mPct}%` }} />
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{mDone}/{mTotal}</span>
                      </div>
                    )}
                    {mTotal === 0 && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>No tasks</div>
                    )}
                  </button>

                  {/* Tasks expanded */}
                  {isExpanded && mTotal > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {m.tasks.map(task => (
                        <div key={task.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-sm)', marginBottom: 4,
                          opacity: task.status === 'done' ? 0.45 : 1,
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                            background: task.status === 'done' ? 'var(--neon)' : 'var(--base-400)',
                          }} />
                          <span style={{
                            flex: 1, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)',
                            textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          }}>
                            {task.title}
                          </span>
                          <span className={`inbox-classify ${CAT_CLASS[task.category] ?? 'classify-note'}`}
                            style={{ fontSize: 7, padding: '1px 5px' }}>
                            {task.category}
                          </span>
                          {task.scheduled_date && (
                            <span style={{ fontSize: 8, color: 'var(--neon)', flexShrink: 0 }}>{fmtDate(task.scheduled_date)}</span>
                          )}
                          {task.estimated_min && (
                            <span style={{ fontSize: 8, color: 'var(--text-muted)', flexShrink: 0 }}>{task.estimated_min}m</span>
                          )}
                        </div>
                      ))}
                      <Link href={`/projects/${projectId}/milestones/${m.id}`}
                        style={{ display: 'block', textAlign: 'center', fontSize: 9, color: 'var(--neon)', marginTop: 4, textDecoration: 'none', letterSpacing: '0.06em' }}>
                        MANAGE TASKS →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
