import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';

type Props = {
  options: string[];
  isScrolling: boolean;
  scrollPosition: number;
  onScrollPositionChange: (position: number | ((prev: number) => number)) => void;
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
  transition: ${props => props.isScrolling ? 'none' : 'transform 0.8s ease-out'};
`;

const QuizSlot = styled.div<{ isCompleteStopped: boolean }>`
  height: 80px;
  width: 300px;
  color: #fff;
  background-color: ${(props) => props.isCompleteStopped ? '#ED6067' : '#2D313A'};
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
  /* 各スロットにbox-shadowを追加 */
  box-shadow: 
    inset 0 8px 16px -6px rgba(0, 0, 0, 0.8),
    inset 0 -8px 16px -6px rgba(0, 0, 0, 0.8);
`;

export const SlotMachine: React.FC<Props> = ({ 
  options, 
  isScrolling, 
  scrollPosition, 
  onScrollPositionChange 
}) => {
  const [isCompleteStopped, setIsCompleteStopped] = useState(false);
  const extendedOptions = [...options, ...options, ...options];
  const startOffset = options.length;

  useEffect(() => {
    if (isScrolling) {
      const interval = setInterval(() => {
        onScrollPositionChange((prevPosition: number) => {
          const newPosition = prevPosition + 5;
          if (newPosition >= options.length * 80) {
            return 0;
          }
          return newPosition;
        });
      }, 25);
      return () => clearInterval(interval);
    } else {
      const timer = setTimeout(() => {
        setIsCompleteStopped(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isScrolling, options.length, onScrollPositionChange]);

  useEffect(() => {
    if (isScrolling) {
      setIsCompleteStopped(false);
    }
  }, [isScrolling]);

  return (
    <SlotContainer>
      <SlotWrapper 
        isScrolling={isScrolling}
        style={{
          transform: `translateY(-${scrollPosition + startOffset * 80}px)`
        }}
      >
        {extendedOptions.map((option, idx) => (
          <QuizSlot isCompleteStopped={isCompleteStopped} key={`${option}-${idx}`}>{option}</QuizSlot>
        ))}
      </SlotWrapper>
    </SlotContainer>
  );
};
