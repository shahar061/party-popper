import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Layout } from '../components/Layout';

describe('Layout', () => {
  it('renders children within mobile-optimized container', () => {
    render(
      <Layout>
        <div data-testid="child">Content</div>
      </Layout>
    );

    const child = screen.getByTestId('child');
    expect(child).toBeInTheDocument();
  });

  it('has no horizontal overflow', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('overflow-x-hidden');
  });

  it('applies minimum height class', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('min-h-screen');
  });

  it('applies safe area inset class', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const layout = container.firstChild as HTMLElement;
    expect(layout).toHaveClass('safe-area-inset');
  });

  it('constrains content to max mobile width', () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const innerContainer = container.querySelector('.max-w-md');
    expect(innerContainer).toBeInTheDocument();
  });
});
