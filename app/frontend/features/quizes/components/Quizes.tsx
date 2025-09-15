import styled from "@emotion/styled";
import { IQuiz, IRunking } from "../types/quiz";
import React from "react";
import { SlotMachine } from "./SlotMachine";
import { useQuiz } from "../hooks/useQuiz";
import { Result } from "./Result";
import { postRunking } from "../api/runking";
import { toast } from "react-toastify";
import { Main } from "../../../components/ui/Main";
import { TitleSet } from "../../../components/ui/TitleSet";

type Props = {
  quizzes: IQuiz[];
};

const Question = styled.h1`
  font-size: clamp(16px, 4vw, 20px);
  font-weight: bold;
  color: #fff;
  margin: 42px 0 0;
  text-align: center;
  min-height: 100px;
  line-height: 1.4;
  max-width: 90vw;
  
  @media (max-width: 360px) {
    margin-bottom: 48px;
    min-height: 80px;
  }
`;

const Index = styled.p`
  color: #fff;
  font-size: clamp(14px, 3.5vw, 16px);
  font-weight: bold;
  margin-bottom: 60px;
  
  @media (max-width: 360px) {
    margin-bottom: 48px;
  }
`;

const ResultButton = styled.button`
  background-color: #5c8edc;
  width: 100%;
  max-width: 90vw;
  min-width: 280px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-size: clamp(14px, 3.5vw, 16px);
  font-weight: bold;
  
  @media (min-width: 400px) {
    max-width: 350px;
  }
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

  return (
    <Main>
      <TitleSet />
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
    </Main>
  );
};
