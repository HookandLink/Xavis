'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface InboxItem {
  id: string; raw_text: string; status: 'pending' | 'done'
  ai_category: string | null; ai_processed_at: string | null; created_at: string
}

const CLASSIFY_CLASS: Record<string, string> = {
  task: 'classify-task', project: 'classify-project', idea: 'classify-idea',
  habit: 'classify-habit', note: 'classify-note', reference: 'classify-reference',
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
    const { data } = await supabase.from('inbox_items').select('*').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSubmitting(true); setSubmitError(null)
    const { data: inserted, error } = await supabase
      .from('inbox_items').insert([{ raw_text: text.trim(), status: 'pending' }]).select().single()
    if (error || !inserted) { setSubmitError(error?.message ?? '저장 실패'); setSubmitting(false); return }
    setText(''); setSubmitting(false); fetchItems()
    setClassifying(inserted.id)
    try {
      await fetch('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inserted.id, text: inserted.raw_text }) })
    } catch { /* silent */ } finally { setClassifying(null); fetchItems() }
  }

  const markDone = async (id: string) => {
    await supabase.from('inbox_items').update({ status: 'done' }).eq('id', id)
    fetchItems()
  }
  const deleteItem = async (id: string) => {
    await supabase.from('inbox_items').delete().eq('id', id)
    fetchItems()
  }

  const pending = items.filter(i => i.status === 'pending')
  const done = items.filter(i => i.status === 'done')

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Inbox</div>
          <div className="page-subtitle">{pending.length} UNCLASSIFIED · AI AUTO-SORT ENABLED</div>
        </div>
      </div>

      {/* Input */}
      <div className="inbox-input-wrap">
        <form onSubmit={handleSubmit}>
          <textarea
            className="inbox-input"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="생각, 아이디어, 할 일... 뭐든 입력하세요. AI가 분류합니다."
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
          />
          <button type="submit" className="inbox-send-btn" disabled={submitting || !text.trim()}>
            {submitting ? '...' : 'SEND →'}
          </button>
        </form>
        {submitError && <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 6 }}>⚠ {submitError}</p>}
      </div>

      {loading ? <div className="metric-label" style={{ paddingTop: 20 }}>Loading...</div> : (
        <>
          {/* Pending */}
          {pending.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>All clear ✓</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.06em' }}>No pending items.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 24 }}>
              <div className="metric-label" style={{ marginBottom: 10 }}>Pending · {pending.length}</div>
              {pending.map(item => (
                <div key={item.id} className="inbox-item">
                  <div className={`inbox-classify ${item.ai_category ? CLASSIFY_CLASS[item.ai_category] ?? 'classify-note' : ''}`}
                    style={!item.ai_category && classifying !== item.id ? { color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--glass-border)' } : {}}>
                    {classifying === item.id ? '···' : (item.ai_category?.toUpperCase() ?? 'NEW')}
                  </div>
                  <div className="inbox-text">{item.raw_text}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => markDone(item.id)} className="inbox-delete" style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: 3, padding: '2px 8px', background: 'var(--glass-bg)' }}>Done</button>
                    <button onClick={() => deleteItem(item.id)} className="inbox-delete">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div style={{ opacity: 0.5 }}>
              <div className="metric-label" style={{ marginBottom: 10 }}>Completed · {done.length}</div>
              {done.slice(0, 10).map(item => (
                <div key={item.id} className="inbox-item">
                  <div className={`inbox-classify ${item.ai_category ? CLASSIFY_CLASS[item.ai_category] ?? 'classify-note' : 'classify-note'}`}>
                    {item.ai_category?.toUpperCase() ?? 'DONE'}
                  </div>
                  <div className="inbox-text" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.raw_text}</div>
                  <button onClick={() => deleteItem(item.id)} className="inbox-delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
