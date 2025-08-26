import styled from '@emotion/styled';
import { Link } from '@inertiajs/react';
import { IQuiz } from '../types/quiz';
import React, { useState } from 'react';

type Props = {
  quizzes: IQuiz[];
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #1B1A2D;
  padding: 20px;
`;

const Question = styled.h1`
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 72px;
  text-align: center;
`;

const Index = styled.p`
  color: #82828B;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 72px;
`;

const SlotContainer = styled.div`
  margin-bottom: 72px;
  border: 3px solid #fff;
  border-radius: 8px;
  height: 80px;
  width: 300px;
  overflow: hidden;
  box-shadow: inset 0 16px 16px -6px rgba(0, 0, 0, 0.9), inset 0 -16px 16px -6px rgba(0, 0, 0, 0.9);
`;

const NextQuizeButton = styled.button`
  background-color: #5C8EDC;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
`

const QuizSlot = styled.div`
  height: 80px;
  width: 300px;
  color: #fff;
  animation: slotAnimation 1s infinite;
  /* background-color: #D65744; */
  background-color: #2D313A;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 8px;
`

export const Quizes: React.FC<Props> = ({quizzes}) => {
  const [index, setIndex] = useState(0);
  const handleNextQuiz = () => {
    setIndex( current => current + 1);
  }
  return (
    <Container>
      <Question>{quizzes[index].question}</Question>
      <Index>({index + 1}/{quizzes.length})</Index>
      <SlotContainer>
        {quizzes.map((quiz) => (
          <QuizSlot key={quiz.id}>{quiz.question}</QuizSlot>
        ))}
      </SlotContainer>
      <NextQuizeButton onClick={handleNextQuiz}>ストップ！</NextQuizeButton>
    </Container>
  )
}
