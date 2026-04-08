import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const generateJobDefinitionTool = createTool({
  id: 'generate_job_definition',
  description:
    'ページ解析結果とユーザー要件からスクレイパージョブ定義JSONを生成する。' +
    'source (URL, 種別, メソッド), extraction (カラム定義), schedule (cron), dashboard (チャート設定) を含む。',
  inputSchema: z.object({
    source_type: z.enum(['csv_download', 'web_scrape', 'pdf_download', 'api']).describe('データソースの種別'),
    source_url: z.string().describe('データ取得元のURL'),
    method: z.enum(['GET', 'POST']).default('GET').describe('HTTPメソッド'),
    form_data: z.record(z.string(), z.string()).optional().describe('POST時のフォームデータ'),
    encoding: z.string().optional().default('UTF-8').describe('文字エンコーディング'),
    columns: z.array(z.object({
      source: z.string().describe('ソースフィールド名 (ヘッダーやキー)'),
      name: z.string().describe('表示名'),
      type: z.enum(['text', 'number']).describe('データ型'),
    })).describe('抽出カラム定義'),
    table_index: z.number().optional().describe('HTMLテーブルのインデックス (web_scrapeの場合)'),
    cron: z.string().describe('スケジュール (cron式, 例: "0 8 * * *")'),
    chart_type: z.enum(['line', 'bar', 'area']).optional().describe('ダッシュボードのチャート種別'),
    x_axis: z.string().optional().describe('チャートのX軸カラム'),
    y_axes: z.array(z.string()).optional().describe('チャートのY軸カラム'),
    job_name: z.string().describe('ジョブ名'),
    description: z.string().describe('ジョブの説明'),
  }),
  execute: async (input) => {
    const jobDefinition = {
      source: {
        type: input.source_type,
        url: input.source_url,
        method: input.method,
        ...(input.form_data && Object.keys(input.form_data).length > 0 && { form_data: input.form_data }),
        ...(input.encoding && input.encoding !== 'UTF-8' && { encoding: input.encoding }),
      },
      extraction: {
        ...(input.table_index !== undefined && { table_index: input.table_index }),
        columns: input.columns,
      },
      schedule: {
        cron: input.cron,
      },
      ...(input.chart_type && input.x_axis && {
        dashboard: {
          chart_type: input.chart_type,
          x_axis: input.x_axis,
          y_axes: input.y_axes || [],
        },
      }),
    }

    return JSON.stringify({
      job_name: input.job_name,
      description: input.description,
      job_definition: jobDefinition,
      source_url: input.source_url,
    }, null, 2)
  },
})
