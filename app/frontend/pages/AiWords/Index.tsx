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
      <Head title="AIクイズ | AI単語帳" />
      <Words words={words} />
    </Layaout>
  )
}