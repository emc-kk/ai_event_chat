import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import * as cheerio from 'cheerio'

export const fetchPageTool = createTool({
  id: 'fetch_page',
  description:
    'URLを指定してWebページを取得し、構造を解析する。テーブル、CSVリンク、フォーム要素を検出し、スクレイピングジョブ定義に必要な情報を抽出する。',
  inputSchema: z.object({
    url: z.string().url().describe('取得するWebページのURL'),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SkillRelay/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: AbortSignal.timeout(15_000),
      })

      if (!response.ok) {
        return `ページの取得に失敗しました (HTTP ${response.status})`
      }

      const contentType = response.headers.get('content-type') || ''
      const html = await response.text()
      const $ = cheerio.load(html)

      const title = $('title').text().trim()

      // テーブル解析
      const tables: Array<{ index: number; headers: string[]; sample_rows: string[][]; row_count: number }> = []
      $('table').each((i, table) => {
        const headers: string[] = []
        $(table).find('thead th, thead td, tr:first-child th, tr:first-child td').each((_, el) => {
          headers.push($(el).text().trim())
        })

        const rows: string[][] = []
        $(table).find('tbody tr, tr').slice(headers.length > 0 ? 1 : 0).each((_, tr) => {
          if (rows.length >= 3) return // サンプルは3行まで
          const row: string[] = []
          $(tr).find('td, th').each((_, td) => {
            row.push($(td).text().trim())
          })
          if (row.length > 0) rows.push(row)
        })

        const rowCount = $(table).find('tbody tr, tr').length
        if (headers.length > 0 || rows.length > 0) {
          tables.push({ index: i, headers, sample_rows: rows, row_count: rowCount })
        }
      })

      // CSVリンク検出
      const csvLinks: Array<{ url: string; text: string }> = []
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const text = $(el).text().trim()
        if (href.match(/\.(csv|tsv|xlsx?|zip)(\?|$)/i) || text.match(/csv|ダウンロード|download|エクスポート/i)) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, url).toString()
          csvLinks.push({ url: fullUrl, text: text || href })
        }
      })

      // フォーム検出 (POST CSVダウンロード用)
      const forms: Array<{ action: string; method: string; inputs: Array<{ name: string; type: string; value: string }> }> = []
      $('form').each((_, form) => {
        const action = $(form).attr('action') || ''
        const method = ($(form).attr('method') || 'GET').toUpperCase()
        const inputs: Array<{ name: string; type: string; value: string }> = []
        $(form).find('input, select').each((_, input) => {
          inputs.push({
            name: $(input).attr('name') || '',
            type: $(input).attr('type') || 'text',
            value: $(input).attr('value') || '',
          })
        })
        if (action || inputs.length > 0) {
          forms.push({
            action: action.startsWith('http') ? action : new URL(action || '', url).toString(),
            method,
            inputs,
          })
        }
      })

      // メタ情報
      const meta = {
        content_type: contentType,
        charset: contentType.match(/charset=([^\s;]+)/i)?.[1] || 'unknown',
        description: $('meta[name="description"]').attr('content') || '',
      }

      const result = {
        title,
        url,
        tables_found: tables.length,
        tables: tables.slice(0, 5), // 最大5テーブル
        csv_links: csvLinks.slice(0, 10),
        forms: forms.slice(0, 5),
        meta,
      }

      return JSON.stringify(result, null, 2)
    } catch (error: any) {
      return `ページ取得エラー: ${error.message}`
    }
  },
})
