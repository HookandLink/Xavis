'use client'

// app/projects/page.tsx
// 프로젝트 목록 + 생성

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { NewProject, Project, ProjectMode } from '@/types'

const defaultForm: NewProject = {
  title: '',
  description: '',
  mode: 'normal',
  importance: 3,
  deadline: '',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [form, setForm] = useState<NewProject>(defaultForm)

  const fetchProjects = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setProjects(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return

    setSubmitting(true)
    setSubmitError(null)
    const { error } = await supabase.from('projects').insert([
      {
        title: form.title.trim(),
        description: form.description?.trim() || null,
        mode: form.mode,
        importance: form.importance,
        deadline: form.deadline || null,
        status: 'active',
      },
    ])

    if (!error) {
      setForm(defaultForm)
      setShowForm(false)
      fetchProjects()
    } else {
      setSubmitError(error.message)
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 mb-6 block">
        ← 홈
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
        >
          {showForm ? '취소' : '+ 새 프로젝트'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-xl p-5 mb-6 space-y-4 border border-gray-800"
        >
          <h2 className="font-medium text-gray-200 text-sm">새 프로젝트</h2>

          <div>
            <label className="text-sm text-gray-400 block mb-1">제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="프로젝트 이름"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">설명 (선택)</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">모드</label>
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as ProjectMode })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="normal">normal</option>
                <option value="exam">exam</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">중요도 (1–5)</label>
              <select
                value={form.importance}
                onChange={(e) => setForm({ ...form, importance: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">마감일 (선택)</label>
            <input
              type="date"
              value={form.deadline ?? ''}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {submitError && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg px-3 py-2 text-sm text-red-300">
              ⚠️ {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition"
          >
            {submitting ? '저장 중...' : '프로젝트 만들기'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500 text-sm">프로젝트가 없습니다. 위에서 추가해보세요.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{p.title}</p>
                    {p.description && (
                      <p className="text-gray-400 text-xs mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      p.mode === 'exam'
                        ? 'bg-red-900 text-red-300'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {p.mode}
                  </span>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span className={p.status === 'active' ? 'text-gray-400' : ''}>{p.status}</span>
                  {p.deadline && <span>📅 {p.deadline}</span>}
                  <span>{'★'.repeat(p.importance)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
