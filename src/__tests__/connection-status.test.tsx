// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConnectionStatus } from '@/components/layout/connection-status';

describe('connection status indicator', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows online and updates to offline when connectivity changes', async () => {
    await act(async () => root.render(<ConnectionStatus />));
    expect(container.textContent).toBe('Online');

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });

    expect(container.textContent).toBe('Offline');
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label'))
      .toBe('Connection status: Offline');

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(container.textContent).toBe('Online');
  });
});
