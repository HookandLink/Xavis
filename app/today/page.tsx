'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { TaskStatus, EnergyCost } from '@/types'

interface TodayTask {
  id: string
  title: string
  status: TaskStatus
  category: string
  importance: number
  estimated_min: number | null
  energy_cost: EnergyCost
  context_type: string
  scheduled_date: string | null
  completed_at: string | null
  milestones: {
    id: string
    title: string
    projects: { id: string; title: string; mode: string }
  }
}

function groupByProject(tasks: TodayTask[]) {
  const map = new Map<string, { projectTitle: string; mode: string; tasks: TodayTask[] }>()
  for (const task of tasks) {
    const pid = task.milestones.projects.id
    if (!map.has(pid)) {
      map.set(pid, { projectTitle: task.milestones.projects.title, mode: task.milestones.projects.mode, tasks: [] })
    }
    map.get(pid)!.tasks.push(task)
  }
  return Array.from(map.values())
}

function getTodayLabel() {
  const d = new Date()
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`
}

export default function TodayPage() {
  const today = new Date().toISOString().split('T')[0]
  const [tasks, setTasks] = useState<TodayTask[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select(`id, title, status, category, importance, estimated_min, energy_cost, context_type, scheduled_date, completed_at,
        milestones ( id, title, projects ( id, title, mode ) )`)
      .eq('scheduled_date', today)
      .neq('status', 'skip')
      .order('importance', { ascending: false })
    if (data) setTasks(data as unknown as TodayTask[])
    setLoading(false)
  }, [today])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const toggleStatus = async (task: TodayTask) => {
    if (toggling) return
    setToggling(task.id)
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id)
    await fetchTasks()
    setToggling(null)
  }

  const doneTasks = tasks.filter(t => t.status === 'done').length
  const totalMin = tasks.reduce((s, t) => s + (t.estimated_min ?? 0), 0)
  const groups = groupByProject(tasks)
  const pct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Today</div>
          <div className="page-subtitle">
            {getTodayLabel()} · {doneTasks} DONE · {tasks.length - doneTasks} REMAINING
          </div>
        </div>
      </div>

      {loading ? (
        <div className="metric-label" style={{ paddingTop: 20 }}>Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No tasks scheduled for today.</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, letterSpacing: '0.06em' }}>
            Add a scheduled date to tasks to see them here.
          </div>
        </div>
      ) : (
        <>
          {/* Progress Summary */}
          <div className="metric-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--neon)' }}>{pct}%</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 10, letterSpacing: '0.08em' }}>
                  {doneTasks} / {tasks.length} DONE
                </span>
              </div>
              {totalMin > 0 && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  {totalMin >= 60 ? `${Math.floor(totalMin/60)}h ${totalMin%60}m` : `${totalMin}m`} TOTAL
                </span>
              )}
            </div>
            <div className="progress-track" style={{ marginTop: 0 }}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Task Groups */}
          {groups.map(group => (
            <div key={group.projectTitle} className="today-group">
              <div className="today-group-header">
                <div className="today-group-label">{group.projectTitle}</div>
                <div className="today-group-count">{group.tasks.length} tasks</div>
                {group.mode === 'exam' && (
                  <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.2)' }}>EXAM</span>
                )}
              </div>
              {group.tasks.map(task => (
                <div
                  key={task.id}
                  className="task-item"
                  onClick={() => toggleStatus(task)}
                  style={{ opacity: toggling === task.id ? 0.5 : 1 }}
                >
                  <div className={`task-check ${task.status === 'done' ? 'done' : ''}`}>
                    {task.status === 'done' && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="#00FFA3" strokeWidth="2">
                        <path d="M1.5 4l2 2 3-3"/>
                      </svg>
                    )}
                  </div>
                  <div className={`task-name ${task.status === 'done' ? 'done' : ''}`}>
                    {task.title}
                  </div>
                  <div
                    className="task-priority"
                    style={{
                      background: task.category === 'must' ? 'var(--danger)'
                        : task.category === 'nice' ? 'var(--warning)'
                        : 'var(--base-300)'
                    }}
                  />
                  <div className={`task-tag ${task.status === 'done' ? '' : task.category}`}>
                    {task.status === 'done' ? 'Done' : task.category}
                  </div>
                  {task.estimated_min && (
                    <div className="task-tag">{task.estimated_min}m</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
