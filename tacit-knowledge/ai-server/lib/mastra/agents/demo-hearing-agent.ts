import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { Agent } from "@mastra/core/agent";
import { hearingMemory } from "../memory";
import { memoryCleanupProcessor } from "../processors";
import type { RequestData } from "../../types";

/**
 * Demo Hearing Agent — デモ環境専用ヒアリングエージェント
 *
 * 本番 hearingAgent との違い:
 * - gpt-4o-mini を使用（音声ヒアリングのレイテンシ最適化）
 * - send_suggestions ツールなし（ツールのラウンドトリップで5-10秒の追加遅延が発生するため）
 * - v4.0 フレームワークのコンテキスト（PBM, バイアス, 引き出し手法, 矛盾, 飽和度）を受け取り
 * - プロンプトは data/demo/demo-hearing-prompts.yml から読み込み
 *
 * 将来の本番化:
 * - このエージェントの処理を hearing-agent.ts に統合
 * - demo-hearing-prompts.yml の内容を prompts.yml に移動
 * - lib/prompts/index.ts の getHearingInstructions() シグネチャを拡張
 * - lib/prompts/types.ts の PromptContext に v4.0 フィールドを追加
 */

interface DemoHearingPrompts {
  hearing: {
    initial_message: string;
    instructions: string;
  };
}

let cachedDemoPrompts: DemoHearingPrompts | null = null;

function loadDemoHearingPrompts(): DemoHearingPrompts {
  if (cachedDemoPrompts) return cachedDemoPrompts;

  const promptsPath = join(process.cwd(), "data", "demo", "demo-hearing-prompts.yml");
  const fileContents = readFileSync(promptsPath, "utf8");
  cachedDemoPrompts = yaml.load(fileContents) as DemoHearingPrompts;
  return cachedDemoPrompts;
}

/**
 * プレースホルダー置換
 *
 * 共有の PromptContext と同じキー名を使用しているため、
 * 将来 lib/prompts/index.ts の formatPrompt() に統合する際はそのまま移行可能
 */
function formatDemoPrompt(
  template: string,
  context: {
    requestData: RequestData;
    pbmStepContext?: string;
    biasAlerts?: string;
    elicitationMethodInstruction?: string;
    contradictionAlerts?: string;
    saturationInfo?: string;
  },
): string {
  const replacements: Record<string, string> = {
    "{topic_name}": context.requestData.topicName || "",
    "{topic_description}": context.requestData.topicDescription || "",
    "{request_name}": context.requestData.name || "",
    "{request_description}": context.requestData.description || "",
    "{request_context}": context.requestData.context || "",
    "{pbm_step_context}": context.pbmStepContext || "",
    "{bias_alerts}": context.biasAlerts || "",
    "{elicitation_method_instruction}": context.elicitationMethodInstruction || "",
    "{contradiction_alerts}": context.contradictionAlerts || "",
    "{saturation_info}": context.saturationInfo || "",
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }
  return result;
}

export function getDemoHearingInitialPrompt(): string {
  const prompts = loadDemoHearingPrompts();
  return prompts.hearing.initial_message.trim();
}

export function demoHearingAgent() {
  return new Agent({
    id: "demo-hearing-agent",
    name: "Demo Hearing Agent",
    instructions: async ({ requestContext }: { requestContext?: { get: (key: string) => unknown } }) => {
      const requestData = requestContext?.get("requestData") as RequestData | undefined;
      const pbmStepContext = requestContext?.get("pbmStepContext") as string | undefined;
      const biasAlerts = requestContext?.get("biasAlerts") as string | undefined;
      const elicitationMethodInstruction = requestContext?.get("elicitationMethodInstruction") as string | undefined;
      const contradictionAlerts = requestContext?.get("contradictionAlerts") as string | undefined;
      const saturationInfo = requestContext?.get("saturationInfo") as string | undefined;

      let content: string;
      if (!requestData) {
        content = "You are a helpful hearing assistant.";
      } else {
        const prompts = loadDemoHearingPrompts();
        content = formatDemoPrompt(prompts.hearing.instructions, {
          requestData,
          pbmStepContext,
          biasAlerts,
          elicitationMethodInstruction,
          contradictionAlerts,
          saturationInfo,
        });
      }

      return {
        role: "system",
        content,
      };
    },
    model: "openai/gpt-4o-mini",
    memory: hearingMemory,
    inputProcessors: [memoryCleanupProcessor],
  });
}
