import * as fs from 'fs'
import * as path from 'path'
import { getTextEmbeddingBatch } from '../lib/services/embedding-service'
import { config } from '../lib/config'

interface FlowOption {
  condition: string
  result: string
  explanation?: string
  nextCheckId?: string
}

interface FlowCheckItem {
  id: string
  question: string
  options: FlowOption[]
}

interface FlowSubStep {
  id: string
  name: string
  checkItems: FlowCheckItem[]
}

interface FlowStep {
  id: string
  name: string
  subSteps: FlowSubStep[]
}

interface FlowData {
  steps: FlowStep[]
}

interface EmbeddingItem {
  checkId: string
  stepName: string
  subStepName: string
  text: string
  embedding: number[]
}

interface FlowEmbeddings {
  model: string
  dimension: number
  generatedAt: string
  items: EmbeddingItem[]
}

function buildSearchText(checkItem: FlowCheckItem): string {
  const parts = [checkItem.question]
  for (const opt of checkItem.options) {
    parts.push(opt.condition)
    if (opt.explanation) {
      parts.push(opt.explanation)
    }
  }
  return parts.join('\n')
}

async function main() {
  const flowDataPath = path.join(process.cwd(), 'data/flow.json')
  const outputPath = path.join(process.cwd(), 'data/flow-embeddings.json')

  console.log('Loading flow.json...')
  const flowData: FlowData = JSON.parse(fs.readFileSync(flowDataPath, 'utf-8'))

  const items: Array<{
    checkId: string
    stepName: string
    subStepName: string
    text: string
  }> = []

  for (const step of flowData.steps) {
    for (const subStep of step.subSteps) {
      for (const checkItem of subStep.checkItems) {
        items.push({
          checkId: checkItem.id,
          stepName: step.name,
          subStepName: subStep.name,
          text: buildSearchText(checkItem),
        })
      }
    }
  }

  console.log(`Found ${items.length} check items`)
  console.log(`Generating embeddings using ${config.openai.embeddingModel}...`)

  const texts = items.map((item) => item.text)
  const BATCH_SIZE = 100
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(texts.length / BATCH_SIZE)}...`)
    const embeddings = await getTextEmbeddingBatch(batch)
    allEmbeddings.push(...embeddings)
  }

  const result: FlowEmbeddings = {
    model: config.openai.embeddingModel,
    dimension: config.openai.embeddingDimension,
    generatedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      ...item,
      embedding: allEmbeddings[index],
    })),
  }

  console.log(`Writing to ${outputPath}...`)
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  console.log('Done!')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
