// app/api/risk-advice/route.ts
// 프로젝트 위험도 분석 결과를 바탕으로 Gemini가 대안책 제시

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { projectTitle, deadline, daysRemaining, totalTasks, doneTasks, todoTasks, riskScore, riskLevel } =
    await req.json()

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 })
  }

  const prompt = `프로젝트 현황:
- 프로젝트명: "${projectTitle}"
- 마감일: ${deadline ?? '없음'}
- 남은 일수: ${daysRemaining !== null ? daysRemaining + '일' : '마감일 없음'}
- 전체 태스크: ${totalTasks}개
- 완료: ${doneTasks}개 (${totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%)
- 미완료: ${todoTasks}개
- 위험도: ${riskLevel} (${riskScore}점)

위 상황에서 실행 가능한 대안책 3가지를 제시해줘.
각 대안은 즉시 행동할 수 있는 구체적인 내용으로 작성해.
아래 JSON 배열 형식으로만 응답해. 다른 텍스트 없이 JSON만.

[
  {
    "title": "대안 제목 (짧게)",
    "action": "구체적인 실행 방법 (1-2문장)",
    "effect": "기대 효과 (한 줄)"
  }
]`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const json = await res.json()
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let advice
  try {
    advice = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: '응답 파싱 실패', raw }, { status: 500 })
  }

  return NextResponse.json({ advice })
}
