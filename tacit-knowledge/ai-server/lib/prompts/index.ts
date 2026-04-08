import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { Prompts, PromptContext } from './types'
import type { RequestData, TopicData } from '../types'

let cachedPrompts: Prompts | null = null

export function loadPrompts(): Prompts {
  if (cachedPrompts) {
    return cachedPrompts
  }

  const promptsPath = join(process.cwd(), 'lib', 'prompts', 'prompts.yml')
  const fileContents = readFileSync(promptsPath, 'utf8')
  cachedPrompts = yaml.load(fileContents) as Prompts

  return cachedPrompts
}

export function formatPrompt(template: string, context: PromptContext): string {
  let result = template

  const replacements: Record<string, string | undefined> = {
    '{topic_name}': context.topicName,
    '{topic_description}': context.topicDescription,
    '{request_name}': context.requestName,
    '{request_description}': context.requestDescription,
    '{request_context}': context.requestContext,
    '{matching_chart_rows}': context.matchingChartRows,
    '{matching_requests}': context.matchingRequests,
    '{user_question}': context.userQuestion,
    '{matching_rows}': context.matchingRows,
    '{user_message}': context.userMessage,
    '{document_content}': context.documentContent,
    '{previous_contexts_with_conversations}': context.previousContextsWithConversations,
    '{new_comment}': context.newComment,
    '{qa_pairs}': context.qaPairs,
    '{schema_description}': context.schemaDescription,
    '{response_schema}': context.responseSchema,
    '{existing_chart_rows}': context.existingChartRows,
    '{new_qa_pairs}': context.newQaPairs || context.newQaPairsForSummary,
    '{existing_summary}': context.existingSummary,
    '{glossary_terms}': context.glossaryTerms,
  }

  for (const [placeholder, value] of Object.entries(replacements)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value)
    }
  }

  return result
}

export function buildPromptContext(
  requestData: RequestData | null,
  topicData?: TopicData | null,
  additionalContext?: Partial<PromptContext>
): PromptContext {
  const context: PromptContext = {
    ...additionalContext,
  }

  if (requestData) {
    context.topicName = requestData.topicName
    context.topicDescription = requestData.topicDescription
    context.requestName = requestData.name
    context.requestDescription = requestData.description
    context.requestContext = requestData.context
  }

  if (topicData) {
    context.topicName = topicData.name
    context.topicDescription = topicData.description
  }

  return context
}

export function getHearingInitialPrompt(): string {
  const prompts = loadPrompts()
  return prompts.chat.hearing.initial_message.trim()
}

export function getHearingInstructions(requestData: RequestData): string {
  const prompts = loadPrompts()
  const context = buildPromptContext(requestData)
  return formatPrompt(prompts.chat.hearing.instructions, context)
}


export function getTopicInstructions(
  topicData: TopicData,
  matchingRequests: string,
  glossaryTerms?: string
): string {
  const prompts = loadPrompts()
  const context = buildPromptContext(null, topicData, { matchingRequests, glossaryTerms })
  return formatPrompt(prompts.chat.topic.instructions, context)
}

export { type Prompts, type PromptContext } from './types'
