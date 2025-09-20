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
      <Head title="AIクイズ | 診断" />
      <Quizzes quizzes={quizzes} />
    </Layaout>
  )
}