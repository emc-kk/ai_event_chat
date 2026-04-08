import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'

interface FlowOption {
  condition: string
  result: string
  explanation?: string
  nextCheckId?: string
}

interface CheckItem {
  id: string
  question: string
  options: FlowOption[]
}

interface SubStep {
  id: string
  name: string
  checkItems: CheckItem[]
}

interface Step {
  id: string
  name: string
  subSteps: SubStep[]
}

interface FlowData {
  steps: Step[]
}

// Normalize question text for matching similar questions
function normalizeQuestion(question: string): string {
  return question
    .replace(/を確認$/m, '')  // Remove trailing "を確認"
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim()
}

function parseResult(resultText: string): { type: string; explanation?: string } {
  const text = resultText.trim()

  if (text.startsWith('→NG') || text === '→NG') {
    const explanation = text.replace(/^→NG\s*/, '').trim()
    return { type: 'NG', explanation: explanation || undefined }
  }
  if (text.startsWith('→OK') || text === '→OK') {
    const explanation = text.replace(/^→OK\s*/, '').trim()
    return { type: 'OK', explanation: explanation || undefined }
  }
  if (text.includes('減点') || text.startsWith('→減点')) {
    const explanation = text.replace(/^→減点\s*/, '').trim()
    return { type: 'DEDUCT', explanation: explanation || undefined }
  }
  if (text.includes('加点') || text.startsWith('→加点') || text.startsWith('→ 加点')) {
    const explanation = text.replace(/^→\s*加点\s*/, '').trim()
    return { type: 'ADD', explanation: explanation || undefined }
  }
  if (text.includes('右のルートへ') || text.startsWith('→右のルートへ')) {
    const explanation = text.replace(/^→右のルートへ\s*/, '').trim()
    return { type: 'NEXT', explanation: explanation || undefined }
  }
  if (text.includes('要精査') || text.includes('NG寄り')) {
    return { type: 'REVIEW', explanation: text }
  }

  return { type: 'NEXT', explanation: text || undefined }
}

function convertCsvToJson(): FlowData {
  const csvPath = path.join(__dirname, '../data/flow.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')

  const records = parse(csvContent, {
    columns: false,
    skip_empty_lines: false,
    relax_quotes: true,
    relax_column_count: true,
  }) as string[][]

  const headerRow = records[0]
  const stepRow = records[1]
  const subStepRow = records[2]
  const dataRows = records.slice(3)

  // Calculate number of column triplets (確認内容, 条件分岐, 結果)
  const numTriplets = Math.floor(headerRow.length / 3)

  // Build step structure
  const stepsMap = new Map<string, Step>()
  const subStepsMap = new Map<string, SubStep>()
  const checkItemsMap = new Map<string, CheckItem>()

  // Process each triplet to identify unique steps, substeps, and questions
  for (let i = 0; i < numTriplets; i++) {
    const baseIdx = i * 3
    const stepName = stepRow[baseIdx]?.trim() || ''
    const subStepName = subStepRow[baseIdx]?.trim() || ''

    if (!stepName || stepName === '確認内容') continue

    // Create or get step
    if (!stepsMap.has(stepName)) {
      const stepId = `step${stepsMap.size}`
      stepsMap.set(stepName, {
        id: stepId,
        name: stepName,
        subSteps: []
      })
    }

    // Create unique key for substep
    const subStepKey = `${stepName}|${subStepName}`
    if (subStepName && !subStepsMap.has(subStepKey)) {
      const step = stepsMap.get(stepName)!
      const subStepId = `${step.id}-sub${step.subSteps.length}`
      const subStep: SubStep = {
        id: subStepId,
        name: subStepName,
        checkItems: []
      }
      subStepsMap.set(subStepKey, subStep)
      step.subSteps.push(subStep)
    }
  }

  // Process data rows to extract check items and options
  for (const row of dataRows) {
    for (let i = 0; i < numTriplets; i++) {
      const baseIdx = i * 3
      const question = row[baseIdx]?.trim() || ''
      const condition = row[baseIdx + 1]?.trim() || ''
      const result = row[baseIdx + 2]?.trim() || ''

      if (!question || question === '→右のルートへ') continue

      const stepName = stepRow[baseIdx]?.trim() || ''
      const subStepName = subStepRow[baseIdx]?.trim() || ''
      const subStepKey = `${stepName}|${subStepName}`
      const subStep = subStepsMap.get(subStepKey)

      if (!subStep) continue

      // Create unique key for check item using normalized question
      const normalizedQ = normalizeQuestion(question)
      const checkKey = `${subStepKey}|${normalizedQ}`

      if (!checkItemsMap.has(checkKey)) {
        const checkId = `${subStep.id}-check${subStep.checkItems.length}`
        const checkItem: CheckItem = {
          id: checkId,
          question: question.replace(/\n/g, '\n'),
          options: []
        }
        checkItemsMap.set(checkKey, checkItem)
        subStep.checkItems.push(checkItem)
      }

      // Add option if condition exists and is unique
      if (condition) {
        const checkItem = checkItemsMap.get(checkKey)!
        const existingOption = checkItem.options.find(o => o.condition === condition)

        if (!existingOption) {
          const parsed = parseResult(result)
          const option: FlowOption = {
            condition,
            result: parsed.type
          }
          if (parsed.explanation) {
            option.explanation = parsed.explanation
          }
          if (parsed.type === 'NEXT' || parsed.type === 'DEDUCT' || parsed.type === 'ADD') {
            // Will calculate nextCheckId after all items are processed
          }
          checkItem.options.push(option)
        }
      }
    }
  }

  // Calculate nextCheckId for NEXT/DEDUCT/ADD options
  const allCheckItems = Array.from(checkItemsMap.values())
  for (let idx = 0; idx < allCheckItems.length; idx++) {
    const checkItem = allCheckItems[idx]
    for (const option of checkItem.options) {
      if (option.result === 'NEXT' || option.result === 'DEDUCT' || option.result === 'ADD') {
        if (idx + 1 < allCheckItems.length) {
          option.nextCheckId = allCheckItems[idx + 1].id
        }
      }
    }
  }

  return {
    steps: Array.from(stepsMap.values())
  }
}

// Main execution
const flowData = convertCsvToJson()
const outputPath = path.join(__dirname, '../data/flow.json')
fs.writeFileSync(outputPath, JSON.stringify(flowData, null, 2), 'utf-8')

console.log(`Converted flow.csv to flow.json`)
console.log(`Steps: ${flowData.steps.length}`)
flowData.steps.forEach(step => {
  console.log(`  ${step.name}: ${step.subSteps.length} substeps`)
  step.subSteps.forEach(sub => {
    console.log(`    ${sub.name}: ${sub.checkItems.length} check items`)
  })
})
