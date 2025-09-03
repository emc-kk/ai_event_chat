import styled from "@emotion/styled";
import React from "react";
import { useSlotMachine } from "../hooks/useSlotMachine";

type Props = {
  options: string[];
  onStop?: (selectedOption: string) => void;
  onNext?: () => void;
  isLastQuiz?: boolean;
  isCompleted?: boolean;
};

const SlotContainer = styled.div`
  margin-bottom: 72px;
  border: 3px solid #fff;
  border-radius: 8px;
  height: 80px;
  width: 300px;
  overflow: hidden;
  position: relative;
  z-index: 1;
`;

const SlotWrapper = styled.div<{ isScrolling: boolean }>`
  display: flex;
  flex-direction: column;
  transition: ${(props) =>
    props.isScrolling ? "none" : "transform 0.8s ease-out"};
`;

const QuizSlot = styled.div<{ isCompleteStopped: boolean }>`
  height: 80px;
  width: 300px;
  color: #fff;
  background-color: ${(props) =>
    props.isCompleteStopped ? "#ED6067" : "#2D313A"};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 8px;
  flex-shrink: 0;
  font-size: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.5s;
  box-shadow: ${(props) =>
    props.isCompleteStopped 
      ? "inset 0 8px 16px -6px rgba(0, 0, 0, 0.8), inset 0 -8px 16px -6px rgba(0, 0, 0, 0.8)"
      : "none"};
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
  border: none;
  cursor: pointer;
  font-weight: bold;

  &:disabled {
    background-color: #4a4a4a;
    cursor: not-allowed;
  }
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
  border: none;
  cursor: pointer;
  font-weight: bold;
`;

export const SlotMachine: React.FC<Props> = ({
  options,
  onStop,
  onNext,
  isLastQuiz = false,
  isCompleted = false,
}) => {
  const {
    isScrolling,
    scrollPosition,
    isCompleteStopped,
    extendedOptions,
    startOffset,
    handleStop,
    reset,
  } = useSlotMachine({ options, onStop });

  const handleNextQuiz = () => {
    reset();
    onNext?.();
  };

  return (
    <>
      <SlotContainer>
        <SlotWrapper
          isScrolling={isScrolling}
          style={{
            transform: `translateY(${-scrollPosition - startOffset * 80}px)`,
          }}
        >
          {extendedOptions.map((option, idx) => (
            <QuizSlot
              isCompleteStopped={isCompleteStopped}
              key={`${option}-${idx}`}
            >
              {option}
            </QuizSlot>
          ))}
        </SlotWrapper>
      </SlotContainer>

      {!isCompleted && (
        <>
          {isScrolling ? (
            <QuizStopButton onClick={handleStop}>ストップ！</QuizStopButton>
          ) : (
            <NextQuizeButton onClick={handleNextQuiz} disabled={isLastQuiz}>
              {isLastQuiz ? "クイズ終了" : "次の問題へ"}
            </NextQuizeButton>
          )}
        </>
      )}
    </>
  );
};
