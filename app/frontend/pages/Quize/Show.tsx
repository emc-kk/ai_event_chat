import { Head } from '@inertiajs/react';
import { Quizes } from '../../features/quizes/components/Quizes';
import { IQuiz } from '../../features/quizes/types/quiz';

type Props = {
  quizzes: IQuiz[];
}

export default function QuizeShow({ quizzes }: Props) {
  return (
    <>
      <Head title="AIレベル診断クイズ | 診断" />
      <Quizes quizzes={quizzes} />
    </>
  )
}