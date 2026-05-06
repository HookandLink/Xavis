'use client'

// app/projects/[id]/page.tsx
// Project 상세 + Milestone 목록/생성 + 위험도 분석

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Project, Milestone, NewMilestone } from '@/types'

// ── 위험도 계산
interface RiskInfo {
  score: number          // 0~100
  level: '안전' | '주의' | '위험'
  color: string
  bg: string
  daysRemaining: number | null
  totalTasks: number
  doneTasks: number
  todoTasks: number
}

function calcRisk(
  project: Project,
  totalTasks: number,
  doneTasks: number
): RiskInfo {
  const todoTasks = totalTasks - doneTasks
  let score = 0
  let daysRemaining: number | null = null

  if (project.deadline) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dl = new Date(project.deadline + 'T00:00:00')
    daysRemaining = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysRemaining < 0) {
      score = 100 // 이미 마감 초과
    } else {
      // 완료율
      const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 1
      if (completionRate < 0.3) score += 25
      else if (completionRate < 0.6) score += 10

      // 남은 일수 vs 남은 태스크
      if (daysRemaining < todoTasks) score += 35
      else if (daysRemaining < todoTasks * 1.5) score += 15

      // 촉박함
      if (daysRemaining <= 1) score += 25
      else if (daysRemaining <= 3) score += 15
      else if (daysRemaining <= 7) score += 5

      // 중요도 가중치
      if (project.importance >= 4) score += 10
    }
  } else {
    // 마감일 없음 — 완료율 기반만
    const completionRate = totalTasks > 0 ? doneTasks / totalTasks : 1
    if (completionRate < 0.2) score = 30
    else if (completionRate < 0.5) score = 15
  }

  score = Math.min(100, Math.max(0, score))

  const level = score >= 67 ? '위험' : score >= 34 ? '주의' : '안전'
  const color = score >= 67 ? 'text-red-400' : score >= 34 ? 'text-yellow-400' : 'text-green-400'
  const bg = score >= 67 ? 'bg-red-900/30 border-red-800' : score >= 34 ? 'bg-yellow-900/30 border-yellow-800' : 'bg-green-900/20 border-green-900'

  return { score, level, color, bg, daysRemaining, totalTasks, doneTasks, todoTasks }
}

interface Advice {
  title: string
  action: string
  effect: string
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [risk, setRisk] = useState<RiskInfo | null>(null)

  // 대안책
  const [advice, setAdvice] = useState<Advice[] | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)

  const [form, setForm] = useState<Omit<NewMilestone, 'project_id'>>({
    title: '',
    due_date: '',
    order_index: 0,
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: proj }, { data: miles }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
    ])

    if (proj) {
      setProject(proj)
      // 프로젝트 전체 태스크 집계
      const milestoneIds = (miles ?? []).map((m) => m.id)
      if (milestoneIds.length > 0) {
        const { data: taskData } = await supabase
          .from('tasks')
          .select('id, status')
          .in('milestone_id', milestoneIds)
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setForm((prev) => ({ ...prev, order_index: milestones.length }))
  }, [milestones.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSubmitting(true)
    await supabase.from('milestones').insert([{
      project_id: projectId,
      title: form.title.trim(),
      due_date: form.due_date || null,
      order_index: form.order_index,
      status: 'todo',
    }])
    setForm({ title: '', due_date: '', order_index: 0 })
    setShowForm(false)
    fetchData()
    setSubmitting(false)
  }

  const handleGetAdvice = async () => {
    if (!project || !risk) return
    setAdviceLoading(true)
    setAdviceError(null)
    setAdvice(null)

    const res = await fetch('/api/risk-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectTitle: project.title,
        deadline: project.deadline,
        daysRemaining: risk.daysRemaining,
        totalTasks: risk.totalTasks,
        doneTasks: risk.doneTasks,
        todoTasks: risk.todoTasks,
        riskScore: risk.score,
        riskLevel: risk.level,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.advice) {
      setAdviceError(data.error ?? 'AI 응답 실패')
    } else {
      setAdvice(data.advice)
    }
    setAdviceLoading(false)
  }

  if (loading) return <main className="min-h-screen bg-gray-950 text-white p-6"><p className="text-gray-500 text-sm">불러오는 중...</p></main>
  if (!project) return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <p className="text-red-400 text-sm">프로젝트를 찾을 수 없습니다.</p>
      <Link href="/projects" className="text-indigo-400 text-sm mt-2 block">← Projects로 돌아가기</Link>
    </main>
  )

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href="/projects" className="text-gray-500 text-sm hover:text-gray-300 mb-4 block">
        ← Projects
      </Link>

      {/* 프로젝트 정보 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">{project.title}</h1>
            {project.description && <p className="text-gray-400 text-sm mt-1">{project.description}</p>}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${project.mode === 'exam' ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
            {project.mode}
          </span>
        </div>
        <div className="flex gap-3 mt-3 text-xs text-gray-500">
          {project.deadline && <span>📅 마감 {project.deadline}</span>}
          <span>중요도 {'★'.repeat(project.importance)}</span>
        </div>
      </div>

      {/* ── 위험도 패널 */}
      {risk && (
        <div className={`border rounded-xl p-4 mb-6 ${risk.bg}`}>
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-200">위험도 분석</span>
              <span className={`text-sm font-bold ${risk.color}`}>{risk.level}</span>
            </div>
            <span className={`text-2xl font-bold ${risk.color}`}>{risk.score}</span>
          </div>

          {/* 게이지 */}
          <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all ${
                risk.score >= 67 ? 'bg-red-500' : risk.score >= 34 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${risk.score}%` }}
            />
          </div>

          {/* 수치 */}
          <div className="flex gap-4 text-xs text-gray-400 mb-3">
            {risk.daysRemaining !== null && (
              <span className={risk.daysRemaining < 0 ? 'text-red-400' : ''}>
                {risk.daysRemaining < 0 ? `⚠️ ${Math.abs(risk.daysRemaining)}일 초과` : `⏳ ${risk.daysRemaining}일 남음`}
              </span>
            )}
            <span>✅ {risk.doneTasks}/{risk.totalTasks} 완료</span>
            <span>📋 미완료 {risk.todoTasks}개</span>
          </div>

          {/* 대안책 버튼 */}
          {!advice && (
            <button
              onClick={handleGetAdvice}
              disabled={adviceLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-200 py-2 rounded-lg text-sm font-medium transition"
            >
              {adviceLoading ? 'AI 분석 중...' : '✨ AI 대안책 보기'}
            </button>
          )}
          {adviceError && <p className="text-red-400 text-xs mt-2">⚠️ {adviceError}</p>}

          {/* 대안책 결과 */}
          {advice && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">AI 대안책</p>
                <button onClick={() => setAdvice(null)} className="text-xs text-gray-600 hover:text-gray-400">닫기</button>
              </div>
              {advice.map((a, i) => (
                <div key={i} className="bg-gray-900/60 rounded-lg p-3">
                  <p className="text-sm font-semibold text-white mb-1">{i + 1}. {a.title}</p>
                  <p className="text-xs text-gray-300 mb-1">{a.action}</p>
                  <p className="text-xs text-indigo-400">→ {a.effect}</p>
                </div>
              ))}
              <button
                onClick={handleGetAdvice}
                disabled={adviceLoading}
                className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition"
              >
                {adviceLoading ? '분석 중...' : '다시 생성'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Milestones 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Milestones</h2>
        <div className="flex gap-2">
          <Link
            href={`/projects/${projectId}/workflow`}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium transition"
          >
            🗺 워크플로우
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
          >
            {showForm ? '취소' : '+ 추가'}
          </button>
        </div>
      </div>

      {/* Milestone 생성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-5 mb-5 space-y-4 border border-gray-800">
          <h3 className="font-medium text-gray-200 text-sm">새 Milestone</h3>
          <div>
            <label className="text-sm text-gray-400 block mb-1">제목 *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="마일스톤 이름"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">마감일 (선택)</label>
              <input type="date" value={form.due_date ?? ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">순서</label>
              <input type="number" value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
                min={0} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition">
            {submitting ? '저장 중...' : 'Milestone 생성'}
          </button>
        </form>
      )}

      {/* Milestone 목록 */}
      {milestones.length === 0 ? (
        <p className="text-gray-500 text-sm">마일스톤이 없습니다. 추가해보세요!</p>
      ) : (
        <ul className="space-y-3">
          {milestones.map((m) => (
            <li key={m.id}>
              <Link href={`/projects/${projectId}/milestones/${m.id}`}
                className="block bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 transition">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.status === 'active' ? 'bg-yellow-900 text-yellow-300'
                    : m.status === 'done' ? 'bg-green-900 text-green-300'
                    : 'bg-gray-800 text-gray-400'
                  }`}>{m.status}</span>
                </div>
                {m.due_date && <p className="text-gray-500 text-xs mt-1">📅 {m.due_date}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
