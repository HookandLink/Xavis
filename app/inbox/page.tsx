'use client'

// app/inbox/page.tsx
// Inbox — 자유 입력 → 저장 → AI 자동 분류

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface InboxItem {
  id: string
  raw_text: string
  status: 'pending' | 'done'
  ai_category: string | null
  ai_processed_at: string | null
  created_at: string
}

const CATEGORY_STYLE: Record<string, string> = {
  task: 'bg-indigo-900 text-indigo-300',
  project: 'bg-purple-900 text-purple-300',
  idea: 'bg-yellow-900 text-yellow-300',
  habit: 'bg-green-900 text-green-300',
  note: 'bg-gray-800 text-gray-300',
  reference: 'bg-blue-900 text-blue-300',
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [classifying, setClassifying] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbox_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // ── 저장 + AI 분류 요청
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    // 1. Supabase에 저장
    const { data: inserted, error } = await supabase
      .from('inbox_items')
      .insert([{ raw_text: text.trim(), status: 'pending' }])
      .select()
      .single()

    if (error || !inserted) {
      setSubmitError(error?.message ?? '저장 실패')
      setSubmitting(false)
      return
    }

    setText('')
    setSubmitting(false)
    fetchItems()

    // 2. AI 분류 요청 (백그라운드)
    setClassifying(inserted.id)
    try {
      const res = await fetch('/api/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inserted.id, text: inserted.raw_text }),
      })
      if (!res.ok) throw new Error('분류 실패')
    } catch {
      // 분류 실패해도 아이템은 저장됨 — 조용히 처리
    } finally {
      setClassifying(null)
      fetchItems()
    }
  }

  // ── 완료 처리
  const markDone = async (id: string) => {
    await supabase.from('inbox_items').update({ status: 'done' }).eq('id', id)
    fetchItems()
  }

  // ── 삭제
  const deleteItem = async (id: string) => {
    await supabase.from('inbox_items').delete().eq('id', id)
    fetchItems()
  }

  const pendingItems = items.filter((i) => i.status === 'pending')
  const doneItems = items.filter((i) => i.status === 'done')

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 max-w-2xl mx-auto">
      <Link href="/" className="text-gray-500 text-sm hover:text-gray-300 mb-6 block">
        ← 홈
      </Link>

      <h1 className="text-2xl font-bold mb-1">Inbox</h1>
      <p className="text-gray-500 text-sm mb-6">생각나는 대로 던져두면 AI가 분류해줘요</p>

      {/* ── 입력 폼 */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="지금 떠오른 것을 입력하세요..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-600"
          />
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-sm font-medium transition"
          >
            {submitting ? '...' : '추가'}
          </button>
        </div>
        {submitError && (
          <p className="text-red-400 text-xs mt-2">⚠️ {submitError}</p>
        )}
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">불러오는 중...</p>
      ) : (
        <>
          {/* ── Pending */}
          {pendingItems.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                처리 대기 · {pendingItems.length}
              </h2>
              <ul className="space-y-2">
                {pendingItems.map((item) => (
                  <InboxCard
                    key={item.id}
                    item={item}
                    isClassifying={classifying === item.id}
                    onDone={() => markDone(item.id)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </ul>
            </section>
          )}

          {/* ── 비어있을 때 */}
          {pendingItems.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center mb-8">
              <p className="text-gray-400 text-sm">처리할 항목이 없어요 ✨</p>
            </div>
          )}

          {/* ── Done */}
          {doneItems.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                완료 · {doneItems.length}
              </h2>
              <ul className="space-y-2 opacity-50">
                {doneItems.slice(0, 10).map((item) => (
                  <InboxCard
                    key={item.id}
                    item={item}
                    isClassifying={false}
                    onDone={() => {}}
                    onDelete={() => deleteItem(item.id)}
                    done
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

// ── 카드 컴포넌트
function InboxCard({
  item,
  isClassifying,
  onDone,
  onDelete,
  done = false,
}: {
  item: InboxItem
  isClassifying: boolean
  onDone: () => void
  onDelete: () => void
  done?: boolean
}) {
  return (
    <li className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* 완료 버튼 */}
        {!done && (
          <button
            onClick={onDone}
            className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-600 hover:border-indigo-400 flex-shrink-0 transition"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-sm ${done ? 'line-through text-gray-500' : 'text-white'}`}>
            {item.raw_text}
          </p>

          {/* AI 분류 배지 */}
          <div className="flex items-center gap-2 mt-1.5">
            {isClassifying ? (
              <span className="text-xs text-gray-500 animate-pulse">AI 분류 중...</span>
            ) : item.ai_category ? (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  CATEGORY_STYLE[item.ai_category] ?? 'bg-gray-800 text-gray-400'
                }`}
              >
                {item.ai_category}
              </span>
            ) : (
              <span className="text-xs text-gray-700">미분류</span>
            )}
            <span className="text-xs text-gray-700">
              {new Date(item.created_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>

        {/* 삭제 버튼 */}
        <button
          onClick={onDelete}
          className="text-gray-700 hover:text-red-400 text-xs transition flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </li>
  )
}
