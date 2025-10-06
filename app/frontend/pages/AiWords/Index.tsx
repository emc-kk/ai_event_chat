import { Head } from "@inertiajs/react";
import { Layaout } from "../../components/layouts/layout";
import { IAiWord } from "../../features/quizzes/types/ai_word";
import { Words } from "../../features/ai_words/components/Words";

type Props = {
  words: IAiWord[];
}

export default function AiWordsIndex({ words }: Props) {
  return (
    <Layaout>
      <Head>
        <title>AI単語帳 – 100のAI用語で基礎と応用を学ぶ</title>
        <meta name="description" content="AIに関する用語を基礎概念やモデル・手法などのカテゴリー別にまとめた全100語の用語集です。" />
      </Head>
      <Words words={words} />
    </Layaout>
  )
}