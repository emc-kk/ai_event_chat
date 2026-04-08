import { Agent } from '@mastra/core/agent'
import { config } from '../../config'
import { webSearchTool } from '../tools/web-search-tool'
import { fetchPageTool } from '../tools/fetch-page-tool'
import { generateJobDefinitionTool } from '../tools/generate-job-definition-tool'

const INSTRUCTIONS = `あなたはデータ取得ジョブの設計アシスタントです。
ユーザーの自然言語での要件から、Webスクレイピング/CSVダウンロード/APIのジョブ定義を自動生成します。

## 手順

1. **要件の理解**: ユーザーが何のデータを取得したいか把握する
2. **データソースの特定**:
   - URLが指定されている場合: fetch_page でページを解析
   - URLがない場合: search_web で候補サイトを検索し、最適なURLを fetch_page で解析
3. **構造の解析**: テーブル、CSVリンク、フォームを検出し、データ構造を理解する
4. **ジョブ定義の生成**: generate_job_definition でジョブ定義JSONを生成

## 判断基準

- CSVダウンロードリンクがある → source_type: 'csv_download'
- HTMLテーブルにデータがある → source_type: 'web_scrape'
- POSTフォームでCSVを取得する → source_type: 'csv_download', method: 'POST'
- APIエンドポイントがある → source_type: 'api'
- PDFリンクがある → source_type: 'pdf_download'

## スケジュールの推定

ユーザーが明示しない場合、データの性質から推定:
- 日次データ (価格、為替、天気) → "0 8 * * *" (毎日8:00)
- 週次データ (週報、統計) → "0 9 * * 1" (毎週月曜9:00)
- 月次データ (月報) → "0 9 1 * *" (毎月1日9:00)
- リアルタイム性が高い → "0 * * * *" (毎時)

## 出力

必ず generate_job_definition ツールを使ってジョブ定義を生成してください。
その後、以下の形式で結果を説明してください:

- なぜこのサイト/URLを選んだか
- どのデータ構造を検出したか
- 推奨するスケジュールとその理由
`

export function scraperJobAgent() {
  return new Agent({
    id: 'scraper-job-agent',
    name: 'Scraper Job Agent',
    instructions: INSTRUCTIONS,
    model: `openai/${config.openai.chatModel}`,
    tools: {
      search_web: webSearchTool,
      fetch_page: fetchPageTool,
      generate_job_definition: generateJobDefinitionTool,
    },
  })
}
