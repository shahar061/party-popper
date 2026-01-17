import { useState, useEffect, useCallback } from 'react';

interface MobileViewportState {
  viewportHeight: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

export function useMobileViewport(): MobileViewportState {
  const [state, setState] = useState<MobileViewportState>(() => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    return {
      viewportHeight: height,
      isKeyboardVisible: false,
      keyboardHeight: 0,
    };
  });

  const updateViewport = useCallback(() => {
    const visualViewport = window.visualViewport;
    const currentHeight = visualViewport?.height ?? window.innerHeight;
    const fullHeight = window.innerHeight;

    // Keyboard is likely visible if viewport height is significantly less than window height
    // Threshold of 150px accounts for browser UI changes
    const heightDifference = fullHeight - currentHeight;
    const isKeyboardVisible = heightDifference > 150;

    setState({
      viewportHeight: currentHeight,
      isKeyboardVisible,
      keyboardHeight: isKeyboardVisible ? heightDifference : 0,
    });

    // Update CSS custom property for use in styles
    document.documentElement.style.setProperty('--vh', `${currentHeight * 0.01}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${heightDifference}px`);
  }, []);

  useEffect(() => {
    // Initial update
    updateViewport();

    // Listen to visualViewport for more accurate mobile viewport handling
    const visualViewport = window.visualViewport;

    if (visualViewport) {
      visualViewport.addEventListener('resize', updateViewport);
      visualViewport.addEventListener('scroll', updateViewport);
    }

    // Fallback for browsers without visualViewport
    window.addEventListener('resize', updateViewport);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateViewport);
        visualViewport.removeEventListener('scroll', updateViewport);
      }
      window.removeEventListener('resize', updateViewport);
    };
  }, [updateViewport]);

  return state;
}
