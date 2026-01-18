import { useState, useEffect } from 'react';

/**
 * Hook specifically for handling virtual keyboard on mobile devices.
 * Returns the current keyboard height and whether it's visible.
 */
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Use Visual Viewport API for accurate keyboard detection
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    let initialHeight = visualViewport.height;

    const handleResize = () => {
      const currentHeight = visualViewport.height;
      const difference = initialHeight - currentHeight;

      // Only consider it a keyboard if the height difference is significant
      if (difference > 100) {
        setKeyboardHeight(difference);
        setIsVisible(true);
      } else {
        setKeyboardHeight(0);
        setIsVisible(false);
        // Update initial height when keyboard closes
        initialHeight = currentHeight;
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  return { keyboardHeight, isVisible };
}
