import { Head } from '@inertiajs/react';
import { Quizzes } from '../../features/quizzes/components/Quizzes';
import { IQuiz } from '../../features/quizzes/types/quiz';
import { Layaout } from '../../components/layouts/layout';

type Props = {
  quizzes: IQuiz[];
}

export default function QuizeIndex({ quizzes }: Props) {
  return (
    <Layaout>
      <Head>
        <title>AIクイズ – 10問でAI理解度チェック</title>
        <meta name="description" content="AIに関する10問のクイズで、あなたのAI理解度をチェックしましょう。初心者から上級者まで楽しめる内容です。" />
      </Head>
      <Quizzes quizzes={quizzes} />
    </Layaout>
  )
}