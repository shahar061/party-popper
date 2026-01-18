import { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  text: string;
  animate?: boolean;
  isTyping?: boolean;
}

export function TypingIndicator({
  text,
  animate = true,
  isTyping = false
}: TypingIndicatorProps) {
  const [displayedText, setDisplayedText] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setDisplayedText(text);
      return;
    }

    // Animate new characters
    if (text.length > displayedText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, 30);
      return () => clearTimeout(timeout);
    } else if (text.length < displayedText.length) {
      setDisplayedText(text);
    }
  }, [text, displayedText, animate]);

  return (
    <span
      data-testid="typing-indicator"
      className="font-mono text-2xl text-white tracking-wide"
    >
      {displayedText || text}
      {isTyping && (
        <span
          data-testid="typing-cursor"
          className="inline-block w-0.5 h-6 bg-yellow-400 ml-1 animate-pulse"
        />
      )}
    </span>
  );
}
