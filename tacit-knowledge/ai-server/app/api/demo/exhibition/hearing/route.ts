import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const INITIAL_MARKER = "__INITIAL_MESSAGE__";

// =====================================================
// トピック × レベル別 固定質問（3問）
// =====================================================
const FIXED_QUESTIONS: Record<string, Record<string, [string, string, string]>> = {
  golf: {
    "初心者（スコア100以上）": [
      "📍 コース情報\nパー：4　｜　距離：330ヤード\n\n📋 状況\nフェアウェイ右側に池があります。\nドライバーなら池を越えて左サイドへ飛ぶ距離感。\n\n▶ どのクラブで打ちますか？",
      "📍 コース情報\nピンまで：15ヤード　｜　グリーンサイドバンカー\n\n📋 状況\nアゴは低め、砂はやや硬め。\n\n▶ どう打ちますか？",
      "📍 コース情報\n距離：8メートルの上りパット\n\n📋 状況\nやや右に切れる傾斜があります。\n2パットでまとめたい状況です。\n\n▶ どう打ちますか？",
    ],
    "中級者（スコア85〜100）": [
      "📍 コース情報\n残り：110ヤード\n\n📋 状況\n左足下がりのライ。\nピンは奥右、アゲンスト1クラブ分。\n\n▶ どう攻めますか？",
      "📍 コース情報\nパー：4　｜　距離：400ヤード　｜　右ドッグレッグ\n\n📋 状況\nコーナーの先にバンカーがある可能性がありますが、\n木が邪魔で見えません。\n\n▶ どう攻めますか？",
      "📍 コース情報\nグリーンエッジから：5ヤード　｜　ピンまで：20ヤード\n\n📋 状況\nピンの奥は下り傾斜です。\n\n▶ どのショットを選びますか？",
    ],
    "上級者（スコア85以下）": [
      "📍 コース情報\nパー：5　｜　残り：230ヤード\n\n📋 状況\nグリーン手前にバンカー。\nスコアはイーブン、ほぼ無風。\n\n▶ どう攻めますか？",
      "📍 コース情報\n残り：150ヤード　｜　打ち上げ：10ヤード分\n\n📋 状況\nフォロー1クラブ分。ピンはグリーン左端。\n\n▶ どう打ちますか？",
      "📍 状況\n15番ホール終了、自己ベストペースで進行中。\n16番は過去に大叩きしたことのある難ホールです。\n\n▶ どんなマインドセットで臨みますか？",
    ],
  },
  wine: {
    "たまに飲む程度": [
      "📍 場面\n友人のホームパーティーへの手土産ワインを選ぶ場面です。\n予算：3,000円　｜　料理：洋食全般\n\n▶ どのワインを選びますか？",
      "📍 場面\nレストランでソムリエに「赤と白どちらにしますか？」と聞かれました。\nメイン：和牛ステーキ\n\n▶ どちらを選びますか？",
      "📍 場面\n上司へのお土産にワインを1本選ぶ場面です。\n予算：5,000円　｜　相手の好み：不明\n\n▶ どのワインを選びますか？",
    ],
    "月に数回自分で選ぶ": [
      "📍 場面\n接待ディナー（フレンチ）での場面です。\n先方：初対面の60代役員　｜　コース：魚介中心\n\n▶ どのワインを選びますか？",
      "📍 場面\nワインリストを渡されましたが、知らない銘柄ばかりです。\n予算：1人5,000円程度\n\n▶ 何を手がかりに選びますか？",
      "📍 場面\n誕生日プレゼントに特別なワインを1本選ぶ場面です。\n相手：ワイン好き　｜　予算：1万円\n\n▶ どのワインを選びますか？",
    ],
    "接待等でよく選ぶ": [
      "📍 場面\n接待相手が「ワインはお任せします」と言いました。\n予算：1本3万円まで　｜　料理：フレンチのコース\n\n▶ どう選びますか？",
      "📍 場面\n同じ予算でボルドーとブルゴーニュで迷っています。\n今夜1本だけ飲む場面です。\n\n▶ どちらを選びますか？",
      "📍 場面\n10年後まで保管できるワインを1本選ぶ場面です。\n目的：自飲み用（投資ではない）\n\n▶ どのワインを選びますか？",
    ],
    "本格的に学んでいる": [
      "📍 場面\nテイスティングの場面です。\n\n▶ 最初に何を確認しますか？",
      "📍 場面\nワインを選ぶ際の優先基準について聞かせてください。\nヴィンテージと生産者、どちらを重視しますか？\n\n▶ どちらを重視しますか？",
      "📍 場面\nワインの産地ごとの選び方について聞かせてください。\n\n▶ 産地によって選び方の軸は変わりますか？",
    ],
  },
  fishing: {
    "たまにやる程度（海釣り・川釣り）": [
      "📍 場面\n週末に釣りに行くことにしました。\n近くに海（堤防）・川（河川）・管理釣り場があります。\n\n▶ どこに行きますか？",
      "📍 場面\n初めての釣り場に到着しました。\n他にも何人か釣り人がいます。\n\n▶ まず何を確認しますか？",
      "📍 場面\n1時間釣って全く釣れません。\n周りの人も釣れていない様子です。\n\n▶ 何を変えますか？",
    ],
    "月に数回楽しむ": [
      "📍 場面\n朝6時から2時間、同じポイントで全く釣れていません。\n隣の人には釣れています。\n\n▶ どう動きますか？",
      "📍 場面\n午後から天気が崩れる予報です。\nまだ全く釣れていません。\n\n▶ どうしますか？",
      "📍 場面\n川に濁りが入ってきました。\nここまでの釣果はまずまずです。\n\n▶ ルアーをどう変えますか？",
    ],
    "本格的にやっている（ルアー・フライ・磯など）": [
      "📍 場面\nシーバス狙いで、上げ潮から下げ潮に変わるタイミングです。\nベイトが表層にいます。\n\n▶ どこを攻めますか？",
      "📍 場面\n実績の高いお気に入りのポイントです。\n今日は2時間全く反応がありません。\n\n▶ どうしますか？",
      "📍 場面\n魚のライズが見えますが、数投してもバイトがありません。\n魚は明らかにいる状況です。\n\n▶ どうアプローチを変えますか？",
    ],
  },
  entertainment: {
    "年に数回程度": [
      "📍 場面\n上司から「来週、取引先を接待してほしい」と初めて言われました。\n予算：一人1万円　｜　相手：面識のある担当者2名\n\n▶ まず何を確認しますか？",
      "📍 場面\n会食が始まって30分。\n料理も来ましたが、相手がなかなか話してくれません。\n\n▶ どう対応しますか？",
      "📍 場面\n会食も終盤、相手方2名がまだ飲み足りなさそうな雰囲気です。\n時刻：21時\n\n▶ 2次会をどうしますか？",
    ],
    "月に1〜2回": [
      "📍 場面\n翌日に大型案件の提案があります。\nその前夜、先方役員2名と会食。まだ関係は浅い状況です。\n\n▶ どんな店を選びますか？",
      "📍 場面\n会食の中盤、場が温まってきたころ、\n相手が自社の人間関係の愚痴を話し始めました。\n\n▶ どう対応しますか？",
      "📍 場面\n予約した個室料理店で、料理が30分経っても来ません。\nオーダーが通っていなかったようです。\n\n▶ どうしますか？",
    ],
    "月に3回以上（接待が日常業務の一部）": [
      "📍 場面\nまだ本題の商談に入っていない段階で、\n相手が酔ってきた様子です。場は盛り上がっています。\n\n▶ どうしますか？",
      "📍 場面\n会食の中盤、先方が\n「最近、競合他社と話しているんですよ」と切り出してきました。\n\n▶ どう対応しますか？",
      "📍 場面\n昨夜の会食は盛況でした。\n先方からも「楽しかった」と言われています。\n\n▶ 翌日のフォローをどうしますか？",
    ],
  },
};

function getFixedQuestion(topic: string, sceneIndex: number): string | null {
  if (sceneIndex >= 3) return null;

  // トピックIDを判定
  let topicId = "";
  if (topic.includes("ゴルフ")) topicId = "golf";
  else if (topic.includes("ワイン")) topicId = "wine";
  else if (topic.includes("釣り")) topicId = "fishing";
  else if (topic.includes("接待")) topicId = "entertainment";
  if (!topicId) return null;

  // レベルラベルを抽出（「/ レベル名）」の形式から取得）
  const match = topic.match(/\/ (.+)）$/);
  if (!match) return null;
  const levelLabel = match[1];

  return FIXED_QUESTIONS[topicId]?.[levelLabel]?.[sceneIndex] ?? null;
}

function buildSystemPrompt(topic: string, answeredCount: number): string {
  let actionInstruction: string;

  const phase = answeredCount % 3; // 0=場面, 1=フォロー1, 2=フォロー2
  const sceneIndex = Math.floor(answeredCount / 3);

  if (answeredCount < 9) {
    if (phase === 0) {
      // 場面提示（固定質問）
      const fixed = getFixedQuestion(topic, sceneIndex);
      actionInstruction = fixed
        ? `次の内容のみを出力してください。この内容以外、一切出力しないでください：\n${fixed}`
        : `**場面${sceneIndex + 1}の質問をしてください。**\nテーマに関連する「具体的な判断の場面」を問う質問のみ。余計な前置き不要。`;
    } else if (phase === 1) {
      // フォローアップ1（なぜ？を引き出す）
      actionInstruction = `**直前の回答を受けて、フォローアップ質問を1文だけ出力してください。**
前置き・要約・共感コメントは一切不要。質問文のみ。
「なぜその判断をしたのか」「その判断の背景にある基準は何か」を深掘りする内容にしてください。`;
    } else {
      // フォローアップ2（さらに深掘り）
      actionInstruction = `**直前の回答を受けて、フォローアップ質問を1文だけ出力してください。**
前置き・要約・共感コメントは一切不要。質問文のみ。
「その判断はどんな経験から来ているか」「似た場面でも変わる条件は何か」など、より具体的な経験則や感覚を引き出す内容にしてください。`;
    }
  } else {
    // answeredCount >= 9: まとめ
    actionInstruction = `**これまでの回答をもとに、来場者が気づいていない判断の構造を論理的に提示してください。**

以下のルールを厳守してください：
- 「おそらく」「〜のはず」「〜かもしれない」などの推測語は一切使わない
- 回答から読み取れる具体的な判断の事実を3つ積み上げ、そこから構造を論理的に導く
- 判断パターンに簡潔な名前をつける（例：「逆算設計型」）
- 「多くの人はこうだが、あなたは違う」という比較構造を必ず入れる
- 感謝・労いの言葉は一切入れない
- 箇条書きは使わず、文章で書く

以下の形式で書いてください：

---

## あなたの判断OS：**「[判断パターンの名前]」**

[回答から読み取れる具体的な判断の事実を3つ、「〜の場面では〜を選んでいました」の形で積み上げる]

つまり、あなたの判断の構造は**「[一言で表した構造]」**です。[多くの人との違いを対比で示す1〜2文]

これは訓練したものではなく、あなたがすでに自然に持っている意思決定の構造です。

---
`;
  }

  return `あなたは暗黙知引き出しAIです。来場者に3つの場面を提示し、各場面で回答を受けた後に2回フォローアップします（合計9回のやりとり）。9回完了後にまとめを出します。

## テーマ
「${topic}」

## 今すること
${actionInstruction}

## ルール
- 必ず日本語で回答する
- 「今すること」に書かれた内容だけを出力する。進捗コメント・前置き・締めの言葉は一切出力しない
- 質問フェーズでは質問のみ（前置き・説明不要）
- まとめフェーズでは指定フォーマット通りに書く
- まとめには「SkillRelay」という単語を一切含めない
- 質問文は自然な日本語にする（例：「優先させた理由」→「優先した理由」、「選択した理由はなんですか」→「なぜそちらを選んだのですか」）`;
}

export async function POST(req: Request) {
  const {
    messages,
    topic,
  }: { messages: UIMessage[]; topic: string; sessionId?: string } =
    await req.json();

  // Count answered questions from message history (no server-side state needed)
  const answeredCount = messages.filter(
    (m) =>
      m.role === "user" &&
      !m.parts?.some((p) => p.type === "text" && p.text === INITIAL_MARKER)
  ).length;

  const phase = answeredCount % 3;
  const sceneIndex = Math.floor(answeredCount / 3);
  console.log(`[HEARING] answeredCount=${answeredCount}, phase=${phase} (0=場面,1=フォロー1,2=フォロー2), sceneIndex=${sceneIndex}, totalMessages=${messages.length}, topic=${topic}`);

  // 場面質問（phase=0）は固定テキストをそのまま返す（AI生成しない）
  if (phase === 0 && answeredCount < 9) {
    const fixed = getFixedQuestion(topic || "", sceneIndex);
    if (fixed) {
      const fixedResult = streamText({
        model: anthropic("claude-haiku-4-5-20251001"),
        system: `次の内容を一字一句そのまま出力してください。改変・追加・省略は一切しないでください。\n\n${fixed}`,
        messages: [{ role: "user", content: "出力してください。" }],
      });
      return createUIMessageStreamResponse({
        stream: fixedResult.toUIMessageStream(),
      });
    }
  }

  const systemPrompt = buildSystemPrompt(topic || "", answeredCount);

  // Replace initial marker with a proper start message for the model
  const processedMessages: UIMessage[] = messages.map((m) => {
    if (
      m.role === "user" &&
      m.parts?.some((p) => p.type === "text" && p.text === INITIAL_MARKER)
    ) {
      return {
        ...m,
        parts: m.parts.map((p) =>
          p.type === "text" && p.text === INITIAL_MARKER
            ? { ...p, text: "ヒアリングを開始してください。" }
            : p
        ),
      };
    }
    return m;
  });

  const modelMessages = await convertToModelMessages(processedMessages);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages: modelMessages,
  });

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  });
}

export async function DELETE() {
  // No server-side state to clear (question count is derived from frontend messages)
  return Response.json({ success: true });
}
