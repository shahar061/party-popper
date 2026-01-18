import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Layout } from '../components/Layout';
import { JoinScreen } from '../components/JoinScreen';

// Device viewport sizes to test
const DEVICE_SIZES = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 14 Pro Max': { width: 430, height: 932 },
  'Android Small': { width: 360, height: 640 },
  'Android Large': { width: 412, height: 915 },
};

describe('Responsive Layout', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
    });
  });

  const setViewport = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      writable: true,
    });
    window.dispatchEvent(new Event('resize'));
  };

  Object.entries(DEVICE_SIZES).forEach(([deviceName, { width, height }]) => {
    describe(`on ${deviceName} (${width}x${height})`, () => {
      beforeEach(() => {
        setViewport(width, height);
      });

      it('renders Layout without horizontal overflow', () => {
        const { container } = render(
          <Layout>
            <div>Test content</div>
          </Layout>
        );

        const layout = container.firstChild as HTMLElement;
        // Layout should have overflow-x-hidden class
        expect(layout).toHaveClass('overflow-x-hidden');
      });

      it('renders JoinScreen form elements', () => {
        const { container } = render(
          <JoinScreen onJoin={() => {}} />
        );

        // Should have form elements
        const form = container.querySelector('form');
        expect(form).toBeInTheDocument();
      });

      it('has touch-friendly button classes', () => {
        const { container } = render(
          <JoinScreen onJoin={() => {}} />
        );

        const buttons = container.querySelectorAll('button');

        buttons.forEach((button) => {
          // Check for min-h-[44px] class (touch target)
          expect(button.className).toMatch(/min-h-\[44px\]|py-4/);
        });
      });
    });
  });
});
