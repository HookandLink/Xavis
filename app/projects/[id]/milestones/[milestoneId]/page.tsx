'use client'

// app/projects/[id]/milestones/[milestoneId]/page.tsx
// Milestone 상세 + Task 목록/생성 + AI 분해 + 자동 배치

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type {
  Milestone,
  Task,
  NewTask,
  TaskCategory,
  EnergyCost,
  ContextType,
} from '@/types'

const CONTEXT_TYPE_OPTIONS: ContextType[] = [
  'book', 'KAL', 'habit', 'exercise',
  'major_study', 'sub_study', 'meeting', 'assignment',
]

const IMPORTANCE_LABELS = ['', '★', '★★', '★★★', '★★★★', '★★★★★']

const ENERGY_COLOR: Record<string, string> = {
  low: 'text-green-400',
  mid: 'text-yellow-400',
  high: 'text-red-400',
}

// ── 자동 배치: todo 태스크를 오늘부터 deadline까지 균등 분배
function autoSchedule(tasks: Task[], deadline: string | null): Record<string, string> {
  const todo = tasks.filter((t) => t.status === 'todo' && !t.scheduled_date)
  if (todo.length === 0) return {}

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = deadline ? new Date(deadline + 'T00:00:00') : new Date(today)
  if (!deadline) end.setDate(end.getDate() + todo.length)

  // 날짜 배열 생성 (오늘 ~ deadline)
  const dates: string[] = []
  const cur = new Date(today)
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  if (dates.length === 0) dates.push(today.toISOString().split('T')[0])

  // must → nice → optional 순 정렬
  const sorted = [...todo].sort((a, b) => {
    const order = { must: 0, nice: 1, optional: 2 }
    return (order[a.category] ?? 1) - (order[b.category] ?? 1)
  })

  // 날짜별 균등 배분
  const result: Record<string, string> = {}
  sorted.forEach((task, i) => {
    result[task.id] = dates[i % dates.length]
  })
  return result
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

  // AI 분해 상태
  const [showAI, setShowAI] = useState(false)
  const [aiDesc, setAiDesc] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // 자동 배치 상태
  const [scheduling, setScheduling] = useState(false)
  const [scheduleResult, setScheduleResult] = useState<string | null>(null)

  const defaultForm: Omit<NewTask, 'milestone_id'> = {
    title: '',
    category: 'must',
    importance: 3,
    estimated_min: undefined,
    energy_cost: 'mid',
    context_type: 'major_study',
    scheduled_date: '',
    due_date: '',
  }
  const [form, setForm] = useState(defaultForm)

  // ── 데이터 불러오기
  const fetchData = async () => {
    setLoading(true)
    const [{ data: mile }, { data: taskData }] = await Promise.all([
      supabase.from('milestones').select('*').eq('id', milestoneId).single(),
      supabase.from('tasks').select('*').eq('milestone_id', milestoneId).order('created_at', { ascending: true }),
    ])
    if (mile) {
      setMilestone(mile)
      // 프로젝트 deadline 가져오기
      const { data: proj } = await supabase
        .from('projects')
        .select('deadline')
        .eq('id', projectId)
        .single()
      setProjectDeadline(proj?.deadline ?? null)
    }
    if (taskData) setTasks(taskData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [milestoneId])

  // ── Task 상태 토글
  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    await supabase
      .from('tasks')
      .update({ status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null })
      .eq('id', task.id)
    fetchData()
  }

  // ── 수동 Task 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    await supabase.from('tasks').insert([{
      milestone_id: milestoneId,
      title: form.title.trim(),
      category: form.category,
      importance: form.importance,
      estimated_min: form.estimated_min || null,
      energy_cost: form.energy_cost,
      context_type: form.context_type,
      scheduled_date: form.scheduled_date || null,
      due_date: form.due_date || null,
      status: 'todo',
    }])
    setForm(defaultForm)
    setShowForm(false)
    fetchData()
    setSubmitting(false)
  }

  // ── AI 분해
  const handleDecompose = async () => {
    if (!aiDesc.trim()) return
    setAiLoading(true)
    setAiError(null)

    const res = await fetch('/api/decompose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        milestoneTitle: milestone?.title,
        description: aiDesc,
        deadline: milestone?.due_date ?? projectDeadline,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.tasks) {
      setAiError(data.error ?? 'AI 분해 실패')
      setAiLoading(false)
      return
    }

    // 분해된 태스크 일괄 저장
    const rows = data.tasks.map((t: Omit<NewTask, 'milestone_id'>) => ({
      milestone_id: milestoneId,
      title: t.title,
      category: t.category ?? 'must',
      importance: t.importance ?? 3,
      estimated_min: t.estimated_min ?? null,
      energy_cost: t.energy_cost ?? 'mid',
      context_type: t.context_type ?? 'major_study',
      status: 'todo',
    }))

    await supabase.from('tasks').insert(rows)
    setAiDesc('')
    setShowAI(false)
    fetchData()
    setAiLoading(false)
  }

  // ── 자동 배치
  const handleAutoSchedule = async () => {
    setScheduling(true)
    setScheduleResult(null)

    const deadline = milestone?.due_date ?? projectDeadline
    const assignments = autoSchedule(tasks, deadline)

    if (Object.keys(assignments).length === 0) {
      setScheduleResult('배치할 태스크가 없어요. (미완료 + 날짜 미배정 태스크 기준)')
      setScheduling(false)
      return
    }

    // 일괄 업데이트
    await Promise.all(
      Object.entries(assignments).map(([id, date]) =>
        supabase.from('tasks').update({ scheduled_date: date }).eq('id', id)
      )
    )

    setScheduleResult(`${Object.keys(assignments).length}개 태스크에 날짜를 배정했어요.`)
    fetchData()
    setScheduling(false)
  }

  if (loading) return <main className="min-h-screen bg-gray-950 text-white p-6"><p className="text-gray-500 text-sm">불러오는 중...</p></main>
  if (!milestone) return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <p className="text-red-400 text-sm">마일스톤을 찾을 수 없습니다.</p>
      <Link href={`/projects/${projectId}`} className="text-indigo-400 text-sm mt-2 block">← 프로젝트로 돌아가기</Link>
    </main>
  )

  const doneTasks = tasks.filter((t) => t.status === 'done').length

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href={`/projects/${projectId}`} className="text-gray-500 text-sm hover:text-gray-300 mb-4 block">
        ← 프로젝트
      </Link>

      {/* 마일스톤 정보 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{milestone.title}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${
            milestone.status === 'active' ? 'bg-yellow-900 text-yellow-300'
            : milestone.status === 'done' ? 'bg-green-900 text-green-300'
            : 'bg-gray-800 text-gray-400'
          }`}>{milestone.status}</span>
        </div>
        {milestone.due_date && <p className="text-gray-500 text-xs mt-2">📅 {milestone.due_date}</p>}
        {tasks.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>진행률</span>
              <span>{doneTasks} / {tasks.length}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${tasks.length ? (doneTasks / tasks.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── AI 도구 패널 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 space-y-3">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">AI 도구</p>

        {/* AI 분해 */}
        <div>
          <button
            onClick={() => { setShowAI(!showAI); setAiError(null) }}
            className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-white transition"
          >
            <span>✨ AI로 태스크 자동 분해</span>
            <span className="text-gray-600">{showAI ? '▲' : '▼'}</span>
          </button>

          {showAI && (
            <div className="mt-3 space-y-2">
              <textarea
                value={aiDesc}
                onChange={(e) => setAiDesc(e.target.value)}
                placeholder={`예: "${milestone.title}"을 위해 무엇을 해야 하는지 자유롭게 설명하세요`}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
              />
              {aiError && <p className="text-red-400 text-xs">⚠️ {aiError}</p>}
              <button
                onClick={handleDecompose}
                disabled={aiLoading || !aiDesc.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium transition"
              >
                {aiLoading ? 'AI 분석 중...' : '태스크 생성하기'}
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800" />

        {/* 자동 배치 */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">📅 미배정 태스크 자동 배치</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {milestone.due_date ?? projectDeadline
                  ? `마감일(${milestone.due_date ?? projectDeadline})까지 균등 분배`
                  : '마감일 없음 — 태스크 수만큼 날짜 배정'}
              </p>
            </div>
            <button
              onClick={handleAutoSchedule}
              disabled={scheduling}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              {scheduling ? '배치 중...' : '실행'}
            </button>
          </div>
          {scheduleResult && (
            <p className="text-xs text-indigo-400 mt-2">{scheduleResult}</p>
          )}
        </div>
      </div>

      {/* Tasks 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
        >
          {showForm ? '취소' : '+ 추가'}
        </button>
      </div>

      {/* Task 생성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-5 mb-5 space-y-4 border border-gray-800">
          <h3 className="font-medium text-gray-200 text-sm">새 Task</h3>
          <div>
            <label className="text-sm text-gray-400 block mb-1">제목 *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="할 일 이름"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">카테고리</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TaskCategory })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="must">must</option>
                <option value="nice">nice</option>
                <option value="optional">optional</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">중요도</label>
              <select value={form.importance} onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{IMPORTANCE_LABELS[n]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">에너지 소비</label>
              <select value={form.energy_cost} onChange={(e) => setForm({ ...form, energy_cost: e.target.value as EnergyCost })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                <option value="low">low 🟢</option>
                <option value="mid">mid 🟡</option>
                <option value="high">high 🔴</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">컨텍스트</label>
              <select value={form.context_type} onChange={(e) => setForm({ ...form, context_type: e.target.value as ContextType })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                {CONTEXT_TYPE_OPTIONS.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">예상 시간 (분, 선택)</label>
            <input type="number" value={form.estimated_min ?? ''}
              onChange={(e) => setForm({ ...form, estimated_min: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="예: 30" min={1}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">예정일 (선택)</label>
              <input type="date" value={form.scheduled_date ?? ''}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">마감일 (선택)</label>
              <input type="date" value={form.due_date ?? ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition">
            {submitting ? '저장 중...' : 'Task 생성'}
          </button>
        </form>
      )}

      {/* Task 목록 */}
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm">태스크가 없습니다. 위 AI 도구로 자동 생성하거나 직접 추가해보세요.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-3">
              <button onClick={() => toggleTaskStatus(task)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition ${
                  task.status === 'done' ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-indigo-400'
                }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
                  {task.title}
                </p>
                <div className="flex flex-wrap gap-2 mt-1 text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${
                    task.category === 'must' ? 'bg-red-900/50 text-red-400'
                    : task.category === 'nice' ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-gray-800 text-gray-500'
                  }`}>{task.category}</span>
                  <span className={ENERGY_COLOR[task.energy_cost]}>{task.energy_cost}</span>
                  <span className="text-gray-500">{task.context_type}</span>
                  {task.estimated_min && <span className="text-gray-500">⏱ {task.estimated_min}분</span>}
                  {task.scheduled_date && <span className="text-indigo-400">📅 {task.scheduled_date}</span>}
                </div>
              </div>
              <span className="text-yellow-400 text-xs flex-shrink-0">{'★'.repeat(task.importance)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
