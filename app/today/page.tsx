'use client'

// app/today/page.tsx
// Today View — 오늘 scheduled_date인 태스크를 프로젝트별로 묶어 표시

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { TaskStatus, EnergyCost } from '@/types'

// ── 조인 결과 타입
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
    projects: {
      id: string
      title: string
      mode: string
    }
  }
}

// ── 날짜 포맷
function getTodayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}

// ── 프로젝트별 그룹화
function groupByProject(tasks: TodayTask[]) {
  const map = new Map<string, { projectTitle: string; mode: string; tasks: TodayTask[] }>()
  for (const task of tasks) {
    const pid = task.milestones.projects.id
    if (!map.has(pid)) {
      map.set(pid, {
        projectTitle: task.milestones.projects.title,
        mode: task.milestones.projects.mode,
        tasks: [],
      })
    }
    map.get(pid)!.tasks.push(task)
  }
  return Array.from(map.values())
}

const ENERGY_DOT: Record<string, string> = {
  low: 'bg-green-400',
  mid: 'bg-yellow-400',
  high: 'bg-red-400',
}

const CATEGORY_COLOR: Record<string, string> = {
  must: 'text-red-400',
  nice: 'text-yellow-400',
  optional: 'text-gray-500',
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
      .select(`
        id, title, status, category, importance,
        estimated_min, energy_cost, context_type,
        scheduled_date, completed_at,
        milestones (
          id, title,
          projects ( id, title, mode )
        )
      `)
      .eq('scheduled_date', today)
      .neq('status', 'skip')
      .order('importance', { ascending: false })

    if (data) setTasks(data as unknown as TodayTask[])
    setLoading(false)
  }, [today])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const toggleStatus = async (task: TodayTask) => {
    if (toggling) return
    setToggling(task.id)
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
    await fetchTasks()
    setToggling(null)
  }

  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const totalMin = tasks.reduce((sum, t) => sum + (t.estimated_min ?? 0), 0)
  const groups = groupByProject(tasks)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 mb-6 block">
        ← 홈
      </Link>

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="text-gray-500 text-sm mt-1">{getTodayLabel(today)}</p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      ) : tasks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-sm">오늘 예정된 태스크가 없어요.</p>
          <p className="text-gray-600 text-xs mt-2">
            태스크에 오늘 날짜로 예정일을 설정하면 여기에 나타납니다.
          </p>
        </div>
      ) : (
        <>
          {/* 진행률 요약 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">
                <span className="text-white font-semibold">{doneTasks}</span>
                <span className="text-gray-500"> / {tasks.length} 완료</span>
              </span>
              {totalMin > 0 && (
                <span className="text-gray-500 text-xs">
                  총 {totalMin >= 60
                    ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
                    : `${totalMin}m`}
                </span>
              )}
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${tasks.length ? (doneTasks / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* 프로젝트별 그룹 */}
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.projectTitle}>
                {/* 프로젝트 헤더 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {group.projectTitle}
                  </span>
                  {group.mode === 'exam' && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-900 text-red-300">exam</span>
                  )}
                </div>

                {/* 태스크 목록 */}
                <ul className="space-y-2">
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className={`bg-gray-900 border rounded-xl p-4 flex items-start gap-3 transition ${
                        task.status === 'done'
                          ? 'border-gray-800 opacity-60'
                          : 'border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      {/* 완료 토글 */}
                      <button
                        onClick={() => toggleStatus(task)}
                        disabled={toggling === task.id}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition ${
                          task.status === 'done'
                            ? 'bg-indigo-500 border-indigo-500'
                            : 'border-gray-600 hover:border-indigo-400'
                        } ${toggling === task.id ? 'opacity-50' : ''}`}
                      >
                        {task.status === 'done' && (
                          <span className="flex items-center justify-center text-white text-xs leading-none">✓</span>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* 제목 */}
                        <p
                          className={`text-sm font-medium leading-snug ${
                            task.status === 'done'
                              ? 'line-through text-gray-500'
                              : 'text-white'
                          }`}
                        >
                          {task.title}
                        </p>

                        {/* 태그 행 */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                          {/* 에너지 */}
                          <span className="flex items-center gap-1 text-gray-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${ENERGY_DOT[task.energy_cost]}`} />
                            {task.energy_cost}
                          </span>

                          {/* 카테고리 */}
                          <span className={CATEGORY_COLOR[task.category]}>{task.category}</span>

                          {/* 컨텍스트 */}
                          <span className="text-gray-600">{task.context_type}</span>

                          {/* 예상 시간 */}
                          {task.estimated_min && (
                            <span className="text-gray-600">⏱ {task.estimated_min}분</span>
                          )}
                        </div>
                      </div>

                      {/* 중요도 */}
                      <span className="text-yellow-500 text-xs flex-shrink-0 mt-0.5">
                        {'★'.repeat(task.importance)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
