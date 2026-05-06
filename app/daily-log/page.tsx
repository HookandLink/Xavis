'use client'

// app/daily-log/page.tsx
// Daily Log — 오늘의 컨디션 체크인 + 과거 기록 조회

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { ProjectMode } from '@/types'

interface DailyLog {
  id: string
  date: string
  energy_level: number
  focus_level: number
  mode: ProjectMode
  tasks_done: number
  note: string | null
  created_at: string
}

interface LogForm {
  energy_level: number
  focus_level: number
  mode: ProjectMode
  note: string
}

const defaultForm: LogForm = {
  energy_level: 3,
  focus_level: 3,
  mode: 'normal',
  note: '',
}

// ── 날짜 포맷
function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
}

// ── 1–5 선택 버튼
function LevelPicker({
  value,
  onChange,
  labels,
}: {
  value: number
  onChange: (v: number) => void
  labels: string[]
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
            value === n
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {labels[n - 1]}
        </button>
      ))}
    </div>
  )
}

const ENERGY_LABELS = ['😴', '😕', '😐', '😊', '🔥']
const FOCUS_LABELS = ['💭', '😵', '🙂', '🎯', '⚡']

export default function DailyLogPage() {
  const today = new Date().toISOString().split('T')[0]

  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)
  const [history, setHistory] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<LogForm>(defaultForm)

  // ── 오늘 완료 태스크 수 자동 계산
  const countDoneTasks = useCallback(async (): Promise<number> => {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_date', today)
      .eq('status', 'done')
    return count ?? 0
  }, [today])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: todayData }, { data: histData }] = await Promise.all([
      supabase.from('daily_logs').select('*').eq('date', today).maybeSingle(),
      supabase
        .from('daily_logs')
        .select('*')
        .neq('date', today)
        .order('date', { ascending: false })
        .limit(14),
    ])
    if (todayData) {
      setTodayLog(todayData)
      setForm({
        energy_level: todayData.energy_level,
        focus_level: todayData.focus_level,
        mode: todayData.mode,
        note: todayData.note ?? '',
      })
    }
    if (histData) setHistory(histData)
    setLoading(false)
  }, [today])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const tasks_done = await countDoneTasks()

    if (todayLog) {
      // 수정
      const { error } = await supabase
        .from('daily_logs')
        .update({
          energy_level: form.energy_level,
          focus_level: form.focus_level,
          mode: form.mode,
          note: form.note.trim() || null,
          tasks_done,
        })
        .eq('id', todayLog.id)
      if (error) {
        setSubmitError(error.message)
      } else {
        setIsEditing(false)
        fetchData()
      }
    } else {
      // 신규
      const { error } = await supabase.from('daily_logs').insert([
        {
          date: today,
          energy_level: form.energy_level,
          focus_level: form.focus_level,
          mode: form.mode,
          note: form.note.trim() || null,
          tasks_done,
        },
      ])
      if (error) {
        setSubmitError(error.message)
      } else {
        fetchData()
      }
    }
    setSubmitting(false)
  }

  const showForm = !todayLog || isEditing

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 mb-6 block">
        ← 홈
      </Link>

      <h1 className="text-2xl font-bold mb-1">Daily Log</h1>
      <p className="text-gray-500 text-sm mb-6">{formatDate(today)}</p>

      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      ) : (
        <>
          {/* ── 오늘 로그 (이미 기록된 경우) */}
          {todayLog && !isEditing && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400 font-medium">오늘 기록 완료</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                >
                  수정
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">에너지</p>
                  <p className="text-2xl">{ENERGY_LABELS[todayLog.energy_level - 1]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Lv.{todayLog.energy_level}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">집중도</p>
                  <p className="text-2xl">{FOCUS_LABELS[todayLog.focus_level - 1]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Lv.{todayLog.focus_level}</p>
                </div>
              </div>

              <div className="flex gap-4 mt-4 text-xs text-gray-500">
                <span>모드: <span className={todayLog.mode === 'exam' ? 'text-red-400' : 'text-gray-300'}>{todayLog.mode}</span></span>
                <span>완료 태스크: <span className="text-gray-300">{todayLog.tasks_done}개</span></span>
              </div>

              {todayLog.note && (
                <p className="mt-4 text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2">
                  {todayLog.note}
                </p>
              )}
            </div>
          )}

          {/* ── 체크인 폼 */}
          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 space-y-5"
            >
              <h2 className="text-sm font-medium text-gray-200">
                {todayLog ? '오늘 기록 수정' : '오늘 체크인'}
              </h2>

              {/* 에너지 */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  에너지 레벨 <span className="text-lg">{ENERGY_LABELS[form.energy_level - 1]}</span>
                </label>
                <LevelPicker
                  value={form.energy_level}
                  onChange={(v) => setForm({ ...form, energy_level: v })}
                  labels={['1', '2', '3', '4', '5']}
                />
              </div>

              {/* 집중도 */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">
                  집중도 <span className="text-lg">{FOCUS_LABELS[form.focus_level - 1]}</span>
                </label>
                <LevelPicker
                  value={form.focus_level}
                  onChange={(v) => setForm({ ...form, focus_level: v })}
                  labels={['1', '2', '3', '4', '5']}
                />
              </div>

              {/* 모드 */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">모드</label>
                <div className="flex gap-3">
                  {(['normal', 'exam'] as ProjectMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm({ ...form, mode: m })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                        form.mode === m
                          ? m === 'exam'
                            ? 'bg-red-700 text-white'
                            : 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">메모 (선택)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="오늘 하루를 한 줄로 기록해보세요"
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {submitError && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
                  ⚠️ {submitError}
                </div>
              )}

              <div className="flex gap-3">
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-medium transition"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition"
                >
                  {submitting ? '저장 중...' : todayLog ? '수정 완료' : '체크인'}
                </button>
              </div>
            </form>
          )}

          {/* ── 과거 기록 */}
          {history.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">
                최근 기록
              </h2>
              <ul className="space-y-2">
                {history.map((log) => (
                  <li
                    key={log.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4"
                  >
                    <span className="text-gray-500 text-xs w-16 flex-shrink-0">{formatDate(log.date)}</span>
                    <span className="text-lg">{ENERGY_LABELS[log.energy_level - 1]}</span>
                    <span className="text-lg">{FOCUS_LABELS[log.focus_level - 1]}</span>
                    <span className="text-xs text-gray-600 flex-1 truncate">{log.note ?? ''}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">✓ {log.tasks_done}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  )
}
