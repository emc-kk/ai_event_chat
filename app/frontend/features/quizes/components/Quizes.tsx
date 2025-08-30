import styled from "@emotion/styled";
import { IQuiz, IRunking } from "../types/quiz";
import React from "react";
import { SlotMachine } from "./SlotMachine";
import { useQuiz } from "../hooks/useQuiz";
import { Result } from "./Result";
import { postRunking } from "../api/runking";
import { toast } from "react-toastify";

type Props = {
  quizzes: IQuiz[];
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #1b1a2d;
  padding: 20px;
`;

const Question = styled.h1`
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 72px;
  text-align: center;
  height: 125px;
`;

const Index = styled.p`
  color: #82828b;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 72px;
`;

const ResultButton = styled.button`
  background-color: #5c8edc;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
`     

export const Quizes: React.FC<Props> = ({ quizzes: orgQuizzes }) => {
  const { 
    currentQuiz, 
    currentIndex, 
    isLastQuiz, 
    isCompleted,
    totalQuizzes,
    quizzes,
    completionTime,
    addAnswer, 
    nextQuiz,
  } = useQuiz({quizzes: orgQuizzes});

  const [runking, setRunking] = React.useState<IRunking>();

  const handleSlotStop = (selectedOption: string) => {
    addAnswer(selectedOption);
  };

  const handleNextQuiz = () => {
    nextQuiz();
  };

  const handleRexult = async () => {
    if (!completionTime) return;
    const corretCount = quizzes.filter(quiz => quiz.isCorrect()).length;
    const answers = quizzes.map(quiz => quiz.userAnswer!);
    try {
      const runking = await postRunking({completionTime, corretCount, answers });
      setRunking(runking);
    } catch (error) {
      console.error(error);
      toast.error('Soorry, something went wrong. Please try again later.');
    }
  }

  if (runking) {
    return <Result quizzes={quizzes} runking={runking} />;
  } 

  console.log(quizzes)

  return (
    <Container>
      <Question>{currentQuiz?.question || "Loading..."}</Question>
      <Index>
        ({currentIndex + 1}/{totalQuizzes})
      </Index>
      <SlotMachine 
        key={currentIndex}
        options={currentQuiz?.options || []}
        onStop={handleSlotStop}
        onNext={handleNextQuiz}
        isLastQuiz={isLastQuiz}
        isCompleted={isCompleted}
      />
      {isCompleted && (
        <ResultButton onClick={handleRexult}>結果を見る</ResultButton>
      )}
    </Container>
  );
};
