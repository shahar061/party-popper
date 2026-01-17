import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen min-h-screen-dynamic overflow-x-hidden bg-game-bg safe-area-inset">
      <div className="flex flex-col min-h-screen-dynamic w-full max-w-md mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
}
