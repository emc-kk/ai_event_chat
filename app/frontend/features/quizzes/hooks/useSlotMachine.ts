import { useState, useEffect, useRef } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // 無限ループのためにオプションを複製
  const extendedOptions = [...options, ...options, ...options, ...options, ...options];
  const startOffset = options.length * 2; // 真ん中のセットから開始
  
  // レスポンシブ対応：スロットの高さを動的に設定
  const slotHeight = useResponsiveSlotHeight();

  // スクロール制御のuseEffect
  useEffect(() => {
    if (isScrolling) {
      const interval = setInterval(() => {
        setScrollPosition(prev => {
          const newPosition = prev - 3; // 移動量を3pxに調整
          if (newPosition <= -options.length * slotHeight) {
            return 0; // 一周したらリセット
          }
          return newPosition;
        });
      }, 30); // 間隔は30msのまま（3px ÷ 30ms = 100px/秒）
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
    
    // SlotItemContainer内の真ん中に表示されている要素を取得
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      
      // SlotWrapper内のすべてのQuizSlot要素を取得
      const slotElements = containerRef.current.querySelectorAll('[data-slot-option]');
      
      let selectedOption = '';
      let minDistance = Infinity;
      
      // 各スロット要素の位置を確認し、コンテナの中央に最も近い要素を見つける
      slotElements.forEach((element) => {
        const elementRect = element.getBoundingClientRect();
        const elementCenter = elementRect.top + elementRect.height / 2;
        const distance = Math.abs(elementCenter - containerCenter);
        
        if (distance < minDistance) {
          minDistance = distance;
          selectedOption = element.getAttribute('data-slot-option') || '';
        }
      });
      
      // コールバック関数があれば実行
      onStop?.(selectedOption);
    }
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
    reset,
    slotRef: containerRef,
  };
};
