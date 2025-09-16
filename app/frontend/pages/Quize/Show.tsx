import { Head } from '@inertiajs/react';
import { Quizes } from '../../features/quizes/components/Quizes';
import { IQuiz } from '../../features/quizes/types/quiz';
import { Layaout } from '../../components/layouts/layout';

type Props = {
  quizzes: IQuiz[];
}

export default function QuizeShow({ quizzes }: Props) {
  return (
    <Layaout>
      <Head title="AIクイズ | 診断" />
      <Quizes quizzes={quizzes} />
    </Layaout>
  )
}