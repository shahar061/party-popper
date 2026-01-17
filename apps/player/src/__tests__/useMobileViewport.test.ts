import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMobileViewport } from '../hooks/useMobileViewport';

describe('useMobileViewport', () => {
  let originalInnerHeight: number;
  let visualViewport: { height: number; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    originalInnerHeight = window.innerHeight;

    visualViewport = {
      height: 800,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    Object.defineProperty(window, 'visualViewport', {
      value: visualViewport,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
    });
  });

  it('returns initial viewport height', () => {
    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.viewportHeight).toBe(800);
  });

  it('sets CSS variable for viewport height', () => {
    renderHook(() => useMobileViewport());

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--vh')).toBe('8px'); // 800 * 0.01
  });

  it('detects keyboard visibility based on viewport change', () => {
    const { result } = renderHook(() => useMobileViewport());

    expect(result.current.isKeyboardVisible).toBe(false);

    // Simulate keyboard opening (viewport shrinks significantly)
    act(() => {
      visualViewport.height = 400;
      const resizeHandler = visualViewport.addEventListener.mock.calls.find(
        (call: string[]) => call[0] === 'resize'
      )?.[1];
      resizeHandler?.();
    });

    expect(result.current.isKeyboardVisible).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useMobileViewport());

    unmount();

    expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
