import { useState, useEffect } from 'react';

interface UseSlotMachineProps {
  options: string[];
  onStop?: (selectedOption: string) => void;
}

const useResponsiveSlotHeight = () => {
  const [slotHeight, setSlotHeight] = useState(80);

  useEffect(() => {
    const updateSlotHeight = () => {
      setSlotHeight(window.innerWidth <= 360 ? 70 : 80);
    };

    // 初回設定
    updateSlotHeight();

    // リサイズイベントリスナー
    window.addEventListener('resize', updateSlotHeight);
    return () => window.removeEventListener('resize', updateSlotHeight);
  }, []);

  return slotHeight;
};

export const useSlotMachine = ({ options, onStop }: UseSlotMachineProps) => {
  const [isScrolling, setIsScrolling] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isCompleteStopped, setIsCompleteStopped] = useState(false);

  // 無限ループのためにオプションを複製
  const extendedOptions = [...options, ...options, ...options];
  const startOffset = options.length; // 真ん中のセットから開始
  
  // レスポンシブ対応：スロットの高さを動的に設定
  const slotHeight = useResponsiveSlotHeight();

  // スクロール制御のuseEffect
  useEffect(() => {
    if (isScrolling) {
      const interval = setInterval(() => {
        setScrollPosition(prev => {
          const newPosition = prev - 5; // 負の方向に変化（下に向かって移動）
          if (newPosition <= -options.length * slotHeight) {
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
  }, [isScrolling, options.length, slotHeight]);

  // isScrollingがtrueになったら、完全停止状態をリセット
  useEffect(() => {
    if (isScrolling) {
      setIsCompleteStopped(false);
    }
  }, [isScrolling]);

  const handleStop = () => {
    setIsScrolling(false);
    const finalPosition = Math.round(scrollPosition / slotHeight) * slotHeight;
    setScrollPosition(finalPosition);
    
    // 停止した位置から選択された選択肢を計算（負の値に対応）
    const selectedOptionIndex = Math.abs(Math.round(scrollPosition / slotHeight)) % options.length;
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
    slotHeight,
    handleStop,
    reset
  };
};
