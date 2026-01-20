import { ReactNode } from 'react';

interface TVLayoutProps {
  children: ReactNode;
  fullScreen?: boolean;
}

/**
 * TV-optimized layout wrapper that ensures:
 * - Safe area margins (reduced to 2% for more screen real estate)
 * - Minimum body text size of 24px (tv-sm)
 * - High contrast dark background with light text
 * - Readable from 3 meters distance
 * - Full-screen mode with no scrolling when fullScreen=true
 */
export function TVLayout({ children, fullScreen = false }: TVLayoutProps) {
  return (
    <div className={`${fullScreen ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-game-bg text-game-text font-body party-bg`}>
      {/* TV safe area container - 2% margin for overscan */}
      <div className={`${fullScreen ? 'h-full' : 'min-h-screen'} p-[2%]`}>
        {children}
      </div>
    </div>
  );
}

/**
 * TV-optimized header with large, readable title
 */
interface TVHeaderProps {
  title: string;
  subtitle?: string;
}

export function TVHeader({ title, subtitle }: TVHeaderProps) {
  return (
    <header className="text-center mb-8">
      <h1 className="text-tv-2xl font-bold text-game-text">{title}</h1>
      {subtitle && (
        <p className="text-tv-base text-game-muted mt-2">{subtitle}</p>
      )}
    </header>
  );
}

/**
 * TV-optimized card container
 */
interface TVCardProps {
  children: ReactNode;
  className?: string;
}

export function TVCard({ children, className = '' }: TVCardProps) {
  return (
    <div
      className={`
        bg-game-surface rounded-2xl p-8
        border-2 border-game-border
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/**
 * TV-optimized button with large touch/click target
 */
interface TVButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export function TVButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: TVButtonProps) {
  const variants = {
    primary: 'bg-green-600 hover:bg-green-500 text-white',
    secondary: 'bg-game-surface hover:bg-game-border text-game-text border border-game-border',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-8 py-4 rounded-xl text-tv-base font-bold
        transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
