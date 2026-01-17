import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl ' +
    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-game-bg ' +
    'transition-colors disabled:cursor-not-allowed min-h-[44px] min-w-[44px]';

  const variantClasses = {
    primary:
      'bg-team-a-600 hover:bg-team-a-500 text-white ' +
      'focus:ring-team-a-500 disabled:bg-game-surface disabled:text-game-muted',
    secondary:
      'bg-game-surface hover:bg-game-border text-white ' +
      'focus:ring-game-border disabled:bg-game-bg disabled:text-game-muted',
    ghost:
      'bg-transparent hover:bg-game-surface text-game-text ' +
      'focus:ring-game-border disabled:text-game-muted',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
