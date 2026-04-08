import { mastra } from "@/lib/mastra"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { prompt, url } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "prompt is required" },
        { status: 400 }
      )
    }

    const agent = mastra.getAgent("scraperJobAgent")

    // ユーザーメッセージを構築
    let userMessage = prompt
    if (url) {
      userMessage += `\n\nURL: ${url}`
    }

    const result = await agent.generate([
      { role: "user", content: userMessage },
    ])

    // テキストからジョブ定義を抽出
    let jobDefinition = null
    const reasoning = result.text || ""

    // toolResultsからJSON抽出を試みる
    const toolResults = (result as any).toolResults
    if (Array.isArray(toolResults)) {
      for (const tr of toolResults) {
        const toolName = tr?.toolName || tr?.name
        const toolResultValue = tr?.result || tr?.output
        if (toolName === "generate_job_definition" && toolResultValue) {
          try {
            jobDefinition = typeof toolResultValue === "string"
              ? JSON.parse(toolResultValue)
              : toolResultValue
          } catch {
            // パース失敗
          }
        }
      }
    }

    // テキストからJSON抽出 (フォールバック)
    if (!jobDefinition && reasoning) {
      const jsonMatch = reasoning.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          jobDefinition = JSON.parse(jsonMatch[1])
        } catch {
          // パース失敗
        }
      }
      // generate_job_definitionの出力がテキストに含まれている場合
      const braceMatch = reasoning.match(/\{[\s\S]*"job_definition"[\s\S]*\}/)
      if (!jobDefinition && braceMatch) {
        try {
          jobDefinition = JSON.parse(braceMatch[0])
        } catch {
          // パース失敗
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        job_definition: jobDefinition?.job_definition || null,
        job_name: jobDefinition?.job_name || null,
        description: jobDefinition?.description || null,
        source_url: jobDefinition?.source_url || url || null,
        reasoning,
      },
    })
  } catch (error: any) {
    console.error("Scraper job generation error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
