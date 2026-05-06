'use client'

// app/projects/[id]/workflow/page.tsx
// 프로젝트 워크플로우 시각화 — 마일스톤 타임라인 + 태스크 현황

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Milestone, Task } from '@/types'

interface MilestoneWithTasks extends Milestone {
  tasks: Task[]
}

// ── 날짜 포맷
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}

// ── 남은 일수 계산
function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dl = new Date(deadline + 'T00:00:00')
  return Math.ceil((dl.getTime() - today.getTime()) / 86400000)
}

// ── 마일스톤 상태 아이콘
function MilestoneIcon({ status }: { status: string }) {
  if (status === 'done') return <span className="text-green-400 text-lg">✅</span>
  if (status === 'active') return <span className="text-yellow-400 text-lg">🔄</span>
  return <span className="text-gray-500 text-lg">⏳</span>
}

// ── 카테고리 색
const CAT_COLOR: Record<string, string> = {
  must: 'bg-red-900/60 text-red-300',
  nice: 'bg-yellow-900/60 text-yellow-300',
  optional: 'bg-gray-800 text-gray-500',
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
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .in('milestone_id', miles.map((m) => m.id))
        .order('created_at')

      const taskMap: Record<string, Task[]> = {}
      tasks?.forEach((t) => {
        if (!taskMap[t.milestone_id]) taskMap[t.milestone_id] = []
        taskMap[t.milestone_id].push(t)
      })

      const merged: MilestoneWithTasks[] = miles.map((m) => ({
        ...m,
        tasks: taskMap[m.id] ?? [],
      }))
      setMilestones(merged)

      // active 마일스톤은 기본 펼침
      const activeIds = new Set(merged.filter((m) => m.status === 'active').map((m) => m.id))
      setExpanded(activeIds)
    }

    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return <main className="min-h-screen bg-gray-950 text-white p-6"><p className="text-gray-500 text-sm">불러오는 중...</p></main>
  if (!project) return <main className="min-h-screen bg-gray-950 text-white p-6"><p className="text-red-400 text-sm">프로젝트를 찾을 수 없습니다.</p></main>

  const allTasks = milestones.flatMap((m) => m.tasks)
  const totalTasks = allTasks.length
  const doneTasks = allTasks.filter((t) => t.status === 'done').length
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const dl = daysLeft(project.deadline ?? null)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href={`/projects/${projectId}`} className="text-gray-500 text-sm hover:text-gray-300 mb-4 block">
        ← 프로젝트
      </Link>

      {/* ── 프로젝트 헤더 요약 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">{project.title}</h1>
            <p className="text-gray-500 text-xs mt-1">
              {milestones.length}개 마일스톤 · {totalTasks}개 태스크
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${project.mode === 'exam' ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
            {project.mode}
          </span>
        </div>

        {/* 전체 진행률 */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 bg-gray-800 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span className="text-sm font-bold text-indigo-400 w-10 text-right">{overallPct}%</span>
        </div>

        <div className="flex gap-4 text-xs text-gray-500">
          <span>✅ {doneTasks}/{totalTasks} 완료</span>
          {project.deadline && (
            <span className={dl !== null && dl < 0 ? 'text-red-400' : dl !== null && dl <= 7 ? 'text-yellow-400' : ''}>
              📅 {project.deadline}
              {dl !== null && (
                dl < 0 ? ` (${Math.abs(dl)}일 초과)` : ` (${dl}일 남음)`
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── 마일스톤 타임라인 */}
      {milestones.length === 0 ? (
        <p className="text-gray-500 text-sm">마일스톤이 없습니다.</p>
      ) : (
        <div className="relative">
          {milestones.map((m, idx) => {
            const mDone = m.tasks.filter((t) => t.status === 'done').length
            const mTotal = m.tasks.length
            const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0
            const isExpanded = expanded.has(m.id)
            const isLast = idx === milestones.length - 1

            return (
              <div key={m.id} className="flex gap-4">
                {/* 타임라인 라인 + 아이콘 */}
                <div className="flex flex-col items-center">
                  <div className="mt-1"><MilestoneIcon status={m.status} /></div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 my-1 ${
                      m.status === 'done' ? 'bg-green-700' : 'bg-gray-800'
                    }`} style={{ minHeight: '2rem' }} />
                  )}
                </div>

                {/* 마일스톤 카드 */}
                <div className="flex-1 pb-6">
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm ${
                        m.status === 'done' ? 'text-gray-400 line-through' : 'text-white'
                      }`}>
                        {m.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.due_date && (
                          <span className="text-xs text-gray-600">{fmtDate(m.due_date)}</span>
                        )}
                        <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* 마일스톤 진행률 바 */}
                    {mTotal > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-gray-800 rounded-full h-1">
                          <div
                            className={`h-1 rounded-full transition-all ${
                              m.status === 'done' ? 'bg-green-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${mPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{mDone}/{mTotal}</span>
                      </div>
                    )}
                    {mTotal === 0 && (
                      <p className="text-xs text-gray-700 mt-1">태스크 없음</p>
                    )}
                  </button>

                  {/* 태스크 목록 (펼침) */}
                  {isExpanded && mTotal > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {m.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                            task.status === 'done'
                              ? 'bg-gray-900/50 opacity-50'
                              : 'bg-gray-900 border border-gray-800'
                          }`}
                        >
                          {/* 완료 점 */}
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            task.status === 'done' ? 'bg-green-500' : 'bg-gray-600'
                          }`} />

                          {/* 제목 */}
                          <span className={`flex-1 truncate ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {task.title}
                          </span>

                          {/* 카테고리 배지 */}
                          <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${CAT_COLOR[task.category]}`}>
                            {task.category}
                          </span>

                          {/* 예정일 */}
                          {task.scheduled_date && (
                            <span className="text-indigo-400 flex-shrink-0">{fmtDate(task.scheduled_date)}</span>
                          )}

                          {/* 예상 시간 */}
                          {task.estimated_min && (
                            <span className="text-gray-600 flex-shrink-0">{task.estimated_min}m</span>
                          )}
                        </div>
                      ))}

                      {/* 마일스톤 이동 링크 */}
                      <Link
                        href={`/projects/${projectId}/milestones/${m.id}`}
                        className="block text-center text-xs text-indigo-500 hover:text-indigo-400 pt-1 transition"
                      >
                        태스크 관리 →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
