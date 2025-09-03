import { useState, useEffect } from 'react';

interface UseSlotMachineProps {
  options: string[];
  onStop?: (selectedOption: string) => void;
}

export const useSlotMachine = ({ options, onStop }: UseSlotMachineProps) => {
  const [isScrolling, setIsScrolling] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isCompleteStopped, setIsCompleteStopped] = useState(false);

  // 無限ループのためにオプションを複製
  const extendedOptions = [...options, ...options, ...options];
  const startOffset = options.length; // 真ん中のセットから開始

  // スクロール制御のuseEffect
  useEffect(() => {
    if (isScrolling) {
      const interval = setInterval(() => {
        setScrollPosition(prev => {
          const newPosition = prev - 5; // 負の方向に変化（下に向かって移動）
          if (newPosition <= -options.length * 80) {
            return 0; // 一周したらリセット
          }
          return newPosition;
        });
      }, 25);
      return () => clearInterval(interval);
    } else {
      // スクロールが停止した際、トランジション完了後に色を変更
      const timer = setTimeout(() => {
        setIsCompleteStopped(true);
      }, 800); // SlotWrapperのトランジション時間（0.8s）と同じ
      return () => clearTimeout(timer);
    }
  }, [isScrolling, options.length]);

  // isScrollingがtrueになったら、完全停止状態をリセット
  useEffect(() => {
    if (isScrolling) {
      setIsCompleteStopped(false);
    }
  }, [isScrolling]);

  const handleStop = () => {
    setIsScrolling(false);
    const finalPosition = Math.round(scrollPosition / 80) * 80;
    setScrollPosition(finalPosition);
    
    // 停止した位置から選択された選択肢を計算（負の値に対応）
    const selectedOptionIndex = Math.abs(Math.round(scrollPosition / 80)) % options.length;
    const selectedOption = options[selectedOptionIndex];
    
    // コールバック関数があれば実行
    onStop?.(selectedOption);
  };

  const reset = () => {
    setIsScrolling(true);
    setScrollPosition(0);
    setIsCompleteStopped(false);
  };

  return {
    isScrolling,
    scrollPosition,
    isCompleteStopped,
    extendedOptions,
    startOffset,
    handleStop,
    reset
  };
};
