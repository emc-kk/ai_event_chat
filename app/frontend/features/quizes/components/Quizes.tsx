import styled from "@emotion/styled";
import { IQuiz } from "../types/quiz";
import React, { useState } from "react";
import { SlotMachine } from "./SlotMachine";

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
`;

const Index = styled.p`
  color: #82828b;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 72px;
`;

const NextQuizeButton = styled.button`
  background-color: #5c8edc;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
`;

const QuizStopButton = styled.button`
  background-color: #2d313a;
  width: 300px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
`;

export const Quizes: React.FC<Props> = ({ quizzes }) => {
  const [answer, setAnswer] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);

  const currentOptions = quizzes[index]?.options || [];

  const handleStop = () => {
    setIsScrolling(false);
    const finalPosition = Math.round(scrollPosition / 80) * 80;
    setScrollPosition(finalPosition);
    
    // 停止した位置から選択された選択肢を計算
    const selectedOptionIndex = Math.round(scrollPosition / 80) % currentOptions.length;
    const selectedOption = currentOptions[selectedOptionIndex];
    
    // 回答を配列で保持
    setAnswer(prevAnswers => {
      const newAnswers = prevAnswers || [];
      return [...newAnswers, selectedOption];
    });
  };

  const handleNextQuiz = () => {
    setIndex((current) => current + 1);
    setIsScrolling(true);
    setScrollPosition(0);
    // 次のクイズに進む際に、現在のクイズの回答をリセット（必要に応じて）
    // setAnswer(null); // コメントアウト: 全ての回答を保持したい場合
  }

  const handleScrollPositionChange = (
    newPositionOrUpdater: number | ((prev: number) => number)
  ) => {
    if (typeof newPositionOrUpdater === "function") {
      setScrollPosition(newPositionOrUpdater);
    } else {
      setScrollPosition(newPositionOrUpdater);
    }
  };

  return (
    <Container>
      <Question>{quizzes[index]?.question || "Loading..."}</Question>
      <Index>
        ({index + 1}/{quizzes.length})
      </Index>
      <SlotMachine
        options={currentOptions}
        isScrolling={isScrolling}
        scrollPosition={scrollPosition}
        onScrollPositionChange={handleScrollPositionChange}
      />
      {isScrolling ? (
        <QuizStopButton onClick={handleStop}>
          ストップ！
        </QuizStopButton>
      ) : (
        <NextQuizeButton onClick={handleNextQuiz}>
          次の問題へ
        </NextQuizeButton>
      )}
    </Container>
  );
};
