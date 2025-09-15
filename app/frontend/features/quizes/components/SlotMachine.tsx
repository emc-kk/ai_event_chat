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

const SlotMachineContainer = styled.div`
  width: 100%;
  height: 120px;
  padding: 20px 0px;
  max-width: 90vw;
  min-width: 280px;
  overflow-y: hidden;
  border-radius: 12px;
  border: 1px solid #fff;
  margin-bottom: 64px;

  @media (min-width: 400px) {
    max-width: 350px;
  }
  
  @media (max-width: 360px) {
    height: 70px;
    margin-bottom: 60px;
  }
`;

const SlotItemContainer = styled.div`
  height: 80px;
  width: 100%;
  position: relative;
  z-index: 1;
`;

const SlotWrapper = styled.div<{ isScrolling: boolean }>`
  display: flex;
  flex-direction: column;
  transition: ${(props) =>
    props.isScrolling ? "none" : "transform 0.8s ease-out"};
`;

const QuizSlot = styled.div`
  height: 80px;
  width: 100%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 12px;
  flex-shrink: 0;
  font-size: clamp(16px, 4vw, 20px);
  font-weight: bold;
  line-height: 1.2;
  border-bottom: 1px solid #fff;
  transition: all 0.5s;
  
  @media (max-width: 360px) {
    height: 70px;
    padding: 0 8px;
    font-size: clamp(14px, 3.5vw, 18px);
  }

  &.first {
    background-color: #FF6B6C;
  }

  &.second {
    background-color: #3778C1;
  }

  &.third {
    background-color: #FFE66D;
    color: #000;
  }

  &.fourth {
    background-color: #9C59B6;
  }
`;

const NextQuizeButton = styled.button`
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
  font-weight: bold;
  font-size: clamp(14px, 3.5vw, 16px);

  @media (min-width: 400px) {
    max-width: 350px;
  }

  &:disabled {
    background-color: #4a4a4a;
    cursor: not-allowed;
  }
`;

const QuizStopButton = styled.button`
  color: #3A7BE8;
  width: 100%;
  max-width: 90vw;
  min-width: 280px;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 24px;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: clamp(14px, 3.5vw, 16px);
  
  @media (min-width: 400px) {
    max-width: 350px;
  }
`;

const choiceStotItemColor = (index: number) => {
  const colors = ["first", "second", "third", "fourth"];
  return colors[index % colors.length];
};

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
    extendedOptions,
    startOffset,
    slotHeight,
    handleStop,
    reset,
  } = useSlotMachine({ options, onStop });

  const handleNextQuiz = () => {
    reset();
    onNext?.();
  };

  return (
    <>
      <SlotMachineContainer>
        <SlotItemContainer>
          <SlotWrapper
            isScrolling={isScrolling}
            style={{
              transform: `translateY(${-scrollPosition - startOffset * slotHeight}px)`,
            }}
          >
            {extendedOptions.map((option, idx) => (
              <QuizSlot
                key={`${option}-${idx}`}
                className={choiceStotItemColor(idx)}
              >
                {option}
              </QuizSlot>
            ))}
          </SlotWrapper>
        </SlotItemContainer>
      </SlotMachineContainer>

      {!isCompleted && (
        <>
          {isScrolling ? (
            <QuizStopButton onClick={handleStop}>ストップ！</QuizStopButton>
          ) : (
            <NextQuizeButton onClick={handleNextQuiz} disabled={isLastQuiz}>
              次の問題へ
            </NextQuizeButton>
          )}
        </>
      )}
    </>
  );
};
