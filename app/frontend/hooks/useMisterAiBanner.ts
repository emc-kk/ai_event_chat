import { useState, useEffect } from 'react';

const BANNER_SHOW_DELAY = 100; // 0.1秒後に表示（デバッグ用）

export const useMisterAiBanner = (currentPath?: string) => {
  const [showBanner, setShowBanner] = useState(false);

  // MisterAIページでは表示しない
  // AiWordsページでは既に専用バナーがあるので表示しない
  const shouldShowBanner = currentPath !== '/mister_ai' && currentPath !== '/ai_words';

  console.log('useMisterAiBanner:', { currentPath, shouldShowBanner, showBanner });

  useEffect(() => {
    console.log('useEffect triggered:', { shouldShowBanner, currentPath });
    
    if (!shouldShowBanner) {
      setShowBanner(false);
      return;
    }

    // 0.1秒後にバナーを表示
    const timer = setTimeout(() => {
      console.log('Setting showBanner to true');
      setShowBanner(true);
    }, BANNER_SHOW_DELAY);

    return () => clearTimeout(timer);
  }, [shouldShowBanner]);

  const dismissBanner = () => {
    setShowBanner(false);
  };

  return {
    showBanner: showBanner && shouldShowBanner,
    dismissBanner
  };
};