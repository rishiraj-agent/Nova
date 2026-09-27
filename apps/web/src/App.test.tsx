import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import App from './App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NOVA workspace', () => {
  it('explains the local model setup when Ollama is unavailable', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/api/v1/ai/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ provider: 'ollama', status: 'unavailable', model: 'llama3.2:3b', available_models: [] }),
        } as Response);
      }
      if (path.endsWith('/api/v1/ai/chat')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ detail: { message: 'Ollama is not running. Start Ollama locally, then try again.' } }),
        } as Response);
      }
      return Promise.reject(new Error('offline'));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }));
    expect(await screen.findByText(/Ollama not running/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Ask NOVA anything...'), {
      target: { value: 'Keep this private' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText(/Your prompt was not saved/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/ai/chat', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Keep this private'),
    }));
    expect(screen.getByPlaceholderText('Ask NOVA anything...')).toHaveProperty('value', 'Keep this private');
  });

  it('renders a reply from the configured local model without saving it', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/api/v1/ai/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ provider: 'ollama', status: 'ready', model: 'llama3.2:3b', available_models: ['llama3.2:3b'] }),
        } as Response);
      }
      if (path.endsWith('/api/v1/ai/chat')) {
        return Promise.resolve({ ok: true, json: async () => ({ reply: 'A local answer.', stored: false }) } as Response);
      }
      return Promise.reject(new Error('offline'));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }));
    fireEvent.change(screen.getByPlaceholderText('Ask NOVA anything...'), {
      target: { value: 'A local question' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('A local answer.')).toBeTruthy();
    expect(screen.getByText('A local question')).toBeTruthy();
  });

  it('shows an actionable empty task state when local storage is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    render(<App />);

    expect(await screen.findByText('A clean slate. Add a task when you’re ready.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'New task' }), {
      target: { value: 'Draft a plan' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByText('Draft a plan')).toBeNull();
  });

  it('filters local navigation from search and supports Escape', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const search = screen.getByPlaceholderText('Search views and tasks...');
    fireEvent.change(search, { target: { value: 'security' } });
    const dialog = screen.getByRole('dialog', { name: 'Search NOVA' });
    expect(within(dialog).getByRole('button', { name: /Security/ })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /Intelligence/ })).toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Search NOVA' })).toBeNull();
  });
});