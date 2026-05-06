// app/api/classify/route.ts
// Inbox 아이템을 Gemini Flash API로 분류하고 Supabase에 저장

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATEGORIES = ['task', 'project', 'idea', 'habit', 'note', 'reference'] as const
type Category = (typeof CATEGORIES)[number]

export async function POST(req: NextRequest) {
  const { id, text } = await req.json()

  if (!id || !text) {
    return NextResponse.json({ error: 'id와 text가 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 })
  }

  // ── Gemini Flash 2.5 API 호출
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `다음 메모를 아래 카테고리 중 하나로만 분류해. 카테고리 단어만 답해.
카테고리: task, project, idea, habit, note, reference

메모: "${text}"`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 20,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const json = await res.json()
  const raw = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().toLowerCase()
  const category: Category = (CATEGORIES as readonly string[]).includes(raw)
    ? (raw as Category)
    : 'note'

  // ── Supabase 업데이트
  const { error } = await supabase
    .from('inbox_items')
    .update({ ai_category: category, ai_processed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category })
}
