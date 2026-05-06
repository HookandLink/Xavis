// app/api/decompose/route.ts
// 마일스톤 설명을 받아 Gemini가 태스크 목록으로 분해

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { milestoneTitle, description, deadline } = await req.json()

  if (!milestoneTitle || !description) {
    return NextResponse.json({ error: 'milestoneTitle과 description이 필요합니다' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 })
  }

  const prompt = `마일스톤: "${milestoneTitle}"
목표 설명: "${description}"
${deadline ? `마감일: ${deadline}` : ''}

위 마일스톤을 실행 가능한 태스크 목록으로 분해해줘.
반드시 아래 JSON 배열 형식으로만 응답해. 다른 텍스트 없이 JSON만.

[
  {
    "title": "태스크 제목 (구체적이고 실행 가능하게)",
    "category": "must | nice | optional 중 하나",
    "estimated_min": 숫자 (예상 소요 분, 15~120 사이),
    "energy_cost": "low | mid | high 중 하나",
    "context_type": "book | KAL | habit | exercise | major_study | sub_study | meeting | assignment 중 하나",
    "importance": 숫자 (1~5 중 하나)
  }
]

규칙:
- 태스크는 3~8개 사이로 만들어
- 각 태스크는 한 번에 집중해서 끝낼 수 있는 크기로
- category는 반드시 해야 하면 must, 하면 좋으면 nice, 없어도 되면 optional
- energy_cost는 집중력이 많이 필요하면 high, 가벼우면 low`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // JSON 파싱 — 마크다운 코드블록 제거 후 파싱
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  let tasks
  try {
    tasks = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: '응답 파싱 실패', raw }, { status: 500 })
  }

  return NextResponse.json({ tasks })
}
