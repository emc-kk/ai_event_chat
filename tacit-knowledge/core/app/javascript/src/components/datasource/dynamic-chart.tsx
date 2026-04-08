import React, { useMemo } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { ColumnDef, JobDefinition } from '../../lib/data-acquisition-api-client'
import type { DARecord } from '../../lib/data-acquisition-api-client'

interface DynamicChartProps {
  records: DARecord[]
  jobDefinition: JobDefinition
}

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]

const DATE_PATTERNS = /date|日|年度|年月|period|month|year|quarter|fiscal/i

function inferAxes(columns: ColumnDef[], dashboard?: JobDefinition['dashboard']) {
  // If dashboard config explicitly defines axes, use those
  if (dashboard?.x_axis && dashboard?.y_axes?.length) {
    return {
      xKey: dashboard.x_axis,
      yKeys: dashboard.y_axes,
      chartType: dashboard.chart_type || 'line',
    }
  }

  const textCols = columns.filter(c => c.type === 'text')
  const numCols = columns.filter(c => c.type === 'number')

  // X-axis: first text column matching date-like pattern, fallback to first text col
  const dateLikeCol = textCols.find(c =>
    DATE_PATTERNS.test(c.name) || DATE_PATTERNS.test(c.source)
  )
  const xKey = dateLikeCol?.name || textCols[0]?.name || 'id'

  // Y-axis: all numeric columns
  const yKeys = numCols.map(c => c.name)

  return { xKey, yKeys, chartType: null as string | null }
}

function prepareChartData(records: DARecord[], xKey: string, yKeys: string[]) {
  return records.map(r => {
    const row: Record<string, unknown> = { [xKey]: r.data[xKey] }
    yKeys.forEach(k => {
      const val = r.data[k]
      row[k] = typeof val === 'number' ? val : Number(val) || 0
    })
    return row
  })
}

export function DynamicChart({ records, jobDefinition }: DynamicChartProps) {
  const columns = jobDefinition.extraction?.columns || []
  const dashboard = jobDefinition.dashboard

  const { xKey, yKeys, chartType: explicitType } = useMemo(
    () => inferAxes(columns, dashboard),
    [columns, dashboard]
  )

  const chartData = useMemo(
    () => prepareChartData(records, xKey, yKeys),
    [records, xKey, yKeys]
  )

  if (yKeys.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="fa-solid fa-chart-line mb-2" style={{ fontSize: 32 }} />
        <p className="small mb-0">数値カラムがないためグラフを表示できません</p>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted py-4">
        <i className="fa-solid fa-chart-bar mb-2" style={{ fontSize: 32 }} />
        <p className="small mb-0">データがありません</p>
      </div>
    )
  }

  // Auto-detect chart type: bar for ≤15 points, line otherwise
  const resolvedType = explicitType || (chartData.length <= 15 ? 'bar' : 'line')

  const commonXAxis = (
    <XAxis
      dataKey={xKey}
      tick={{ fontSize: 10, fill: '#9ca3af' }}
      axisLine={{ stroke: '#e5e7eb' }}
      tickLine={false}
      interval="preserveStartEnd"
    />
  )

  const commonYAxis = (
    <YAxis
      tick={{ fontSize: 10, fill: '#9ca3af' }}
      axisLine={false}
      tickLine={false}
      width={50}
    />
  )

  const commonTooltip = (
    <Tooltip
      contentStyle={{
        fontSize: 11,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    />
  )

  const commonGrid = <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
  const commonLegend = yKeys.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null

  const renderChart = () => {
    if (resolvedType === 'bar') {
      return (
        <BarChart data={chartData}>
          {commonGrid}
          {commonXAxis}
          {commonYAxis}
          {commonTooltip}
          {commonLegend}
          {yKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      )
    }

    if (resolvedType === 'area') {
      return (
        <AreaChart data={chartData}>
          <defs>
            {yKeys.map((key, i) => (
              <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {commonGrid}
          {commonXAxis}
          {commonYAxis}
          {commonTooltip}
          {commonLegend}
          {yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              fill={`url(#grad-${i})`}
              dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      )
    }

    // Default: line
    return (
      <LineChart data={chartData}>
        {commonGrid}
        {commonXAxis}
        {commonYAxis}
        {commonTooltip}
        {commonLegend}
        {yKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      {renderChart()}
    </ResponsiveContainer>
  )
}
