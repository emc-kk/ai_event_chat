import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/services/database-service'
import { config } from '@/lib/config'

interface HearingQA {
  request_id: string
  question: string
  answer: string
}

interface HearingMessage {
  id: string
  request_id: string
  content: string
  message_type: number
  created_at: string
}

interface ComparisonElement {
  classification: 'consensus' | 'divergence' | 'gap'
  knowledge_element: string
  responses: Array<{
    request_id: string
    respondent_name: string
    content: string
  }>
}

export async function POST(request: NextRequest) {
  let comparison_session_id: string | null = null

  try {
    const body = await request.json()
    const { comparison_session_id: sessionId, topic_id, request_ids } = body
    comparison_session_id = sessionId

    if (!comparison_session_id || !request_ids || request_ids.length < 2) {
      return NextResponse.json(
        { error: 'comparison_session_id and at least 2 request_ids are required' },
        { status: 400 }
      )
    }

    // 1. 各リクエストのヒアリングメッセージデータを取得（messagesテーブルから）
    const qaDataByRequest: Record<string, { respondent_name: string; qa: HearingQA[] }> = {}

    for (const requestId of request_ids) {
      const respondent = await query<{ name: string }>(
        `SELECT u.name FROM requests r JOIN users u ON r.respondent_id = u.id WHERE r.id = $1`,
        [requestId]
      )
      const respondentName = respondent[0]?.name || `回答者(${requestId.slice(0, 8)})`

      // messagesテーブルからヒアリングメッセージを取得
      // message_type: 0 = question (AI), 1 = answer (respondent)
      const messages = await query<HearingMessage>(
        `SELECT id, request_id, content, message_type, created_at
         FROM messages
         WHERE request_id = $1
         ORDER BY created_at`,
        [requestId]
      )

      // Q&Aペアに変換
      const qaPairs: HearingQA[] = []
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i]
        if (msg.message_type === 0) {
          // 質問メッセージ → 次のメッセージが回答
          const answerMsg = messages[i + 1]
          if (answerMsg && answerMsg.message_type === 1) {
            qaPairs.push({
              request_id: requestId,
              question: msg.content,
              answer: answerMsg.content,
            })
            i++ // 回答メッセージをスキップ
          }
        }
      }

      qaDataByRequest[requestId] = {
        respondent_name: respondentName,
        qa: qaPairs,
      }
    }

    // 2. LLMで比較分析を実行
    const comparisonPrompt = buildComparisonPrompt(qaDataByRequest, request_ids)

    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: config.openai.apiKey })

    const response = await client.chat.completions.create({
      model: config.openai.chatModel,
      max_completion_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: comparisonPrompt,
        },
      ],
    })

    const responseText = response.choices[0]?.message?.content || ''

    // 3. JSON部分を抽出してパース
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/) || responseText.match(/\[[\s\S]*\]/)
    let elements: ComparisonElement[] = []

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      elements = JSON.parse(jsonStr)
    }

    if (elements.length === 0) {
      // フォールバック: 全体をパース試行
      try {
        elements = JSON.parse(responseText)
      } catch {
        console.error('Failed to parse comparison response')
        elements = []
      }
    }

    // 4. 比較要素をDBに保存
    const ulid = (await import('ulid')).ulid
    for (const element of elements) {
      const classificationMap = { consensus: 0, divergence: 1, gap: 2 }
      await query(
        `INSERT INTO comparison_elements (id, comparison_session_id, classification, knowledge_element, responses, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [
          ulid(),
          comparison_session_id,
          classificationMap[element.classification] ?? 0,
          element.knowledge_element,
          JSON.stringify(element.responses),
        ]
      )
    }

    // 5. 一致率を計算してセッションを更新
    const totalElements = elements.length
    const consensusCount = elements.filter((e) => e.classification === 'consensus').length
    const consensusRate = totalElements > 0 ? consensusCount / totalElements : 0

    await query(
      `UPDATE comparison_sessions SET status = 1, consensus_rate = $1, updated_at = NOW() WHERE id = $2`,
      [consensusRate, comparison_session_id]
    )

    return NextResponse.json({
      success: true,
      comparison_session_id,
      total_elements: totalElements,
      consensus_count: consensusCount,
      divergence_count: elements.filter((e) => e.classification === 'divergence').length,
      gap_count: elements.filter((e) => e.classification === 'gap').length,
      consensus_rate: consensusRate,
    })
  } catch (error) {
    console.error('Comparison analysis error:', error)

    // エラー時もセッションのステータスを更新（スピナーが回り続けないように）
    if (comparison_session_id) {
      try {
        await query(
          `UPDATE comparison_sessions SET status = 1, consensus_rate = 0, updated_at = NOW() WHERE id = $1 AND status = 0`,
          [comparison_session_id]
        )
      } catch (updateError) {
        console.error('Failed to update session status on error:', updateError)
      }
    }

    return NextResponse.json({ error: 'Comparison analysis failed' }, { status: 500 })
  }
}

function buildComparisonPrompt(
  qaDataByRequest: Record<string, { respondent_name: string; qa: HearingQA[] }>,
  requestIds: string[]
): string {
  let veteranSections = ''

  for (const requestId of requestIds) {
    const data = qaDataByRequest[requestId]
    if (!data) continue

    veteranSections += `\n## ${data.respondent_name} のヒアリング結果\n`
    for (const qa of data.qa) {
      veteranSections += `\n**Q:** ${qa.question}\n**A:** ${qa.answer}\n`
    }
  }

  return `あなたは暗黙知の比較分析エキスパートです。
複数のベテランから同一トピックについてヒアリングした結果を分析し、知識の「一致」「差分」「欠落」を分類してください。

${veteranSections}

## 分析指示

上記のヒアリング結果を「知識要素」単位で分解し、ベテラン間で比較してください。
知識要素とは、1つの判断基準・1つの手順ステップ・1つの条件分岐など、意味的に独立した最小単位です。

### 分類基準
- **consensus（一致）**: 全員が同じまたは実質同等の判断基準・手順を述べている
- **divergence（差分）**: ベテランによって異なる判断基準・手順が存在する
- **gap（欠落）**: 一部のベテランのみが言及し、他は触れていない知識

### 出力形式
以下のJSON配列で出力してください。
\`\`\`json
[
  {
    "classification": "consensus" | "divergence" | "gap",
    "knowledge_element": "知識要素の要約（日本語）",
    "responses": [
      {
        "request_id": "リクエストID",
        "respondent_name": "回答者名",
        "content": "この知識要素に関する回答内容の要約（日本語）"
      }
    ]
  }
]
\`\`\`

注意:
- 各知識要素について、言及した全てのベテランのresponsesを含めること
- gap（欠落）の場合、言及していないベテランはresponsesに含めない
- knowledge_elementは簡潔かつ具体的に記述すること
- 日本語で出力すること
- JSON配列のみを出力し、他の説明は不要

出力:`
}
