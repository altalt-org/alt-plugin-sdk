import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AltPluginApi } from './client';
import { createAltFetch } from './ai';

const globalWithWindow = globalThis as unknown as {
  window?: Window &
    typeof globalThis & {
      alt: AltPluginApi;
    };
};

describe('alt-plugin-sdk ai helpers', () => {
  afterEach(() => {
    delete globalWithWindow.window;
  });

  it('creates a fetch compatible with OpenAI-compatible chat completions', async () => {
    const stream = vi.fn(async (_request, handlers) => {
      handlers.onStart({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      handlers.onChunk(new TextEncoder().encode('data: {}\n\n').buffer);
      handlers.onEnd();
      return { cancel: vi.fn() };
    }) satisfies AltPluginApi['ai']['stream'];

    globalWithWindow.window = {
      alt: {
        ai: {
          models: {
            list: vi.fn(async () => []),
          },
          stream,
        },
        storage: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        },
        state: {
          getActiveNoteSummary: vi.fn(),
        },
        events: {
          subscribe: vi.fn(),
        },
        actions: {
          invoke: vi.fn(),
        },
      },
    } as unknown as Window & typeof globalThis & { alt: AltPluginApi };

    const fetch = createAltFetch();
    const response = await fetch(
      'https://alt-plugin.invalid/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer plugin-should-not-send-this',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'gpt-5.4', messages: [] }),
      },
    );

    await expect(response.text()).resolves.toBe('data: {}\n\n');
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'chat.completions',
        model: 'gpt-5.4',
        headers: { 'content-type': 'application/json' },
      }),
      expect.any(Object),
    );
  });

  it('rejects when the host reports an error before response start', async () => {
    const stream = vi.fn(async (_request, handlers) => {
      handlers.onError({
        code: 'FORBIDDEN',
        message: 'Plugin AI model is not available',
      });
      return { cancel: vi.fn() };
    }) satisfies AltPluginApi['ai']['stream'];

    globalWithWindow.window = {
      alt: {
        ai: {
          models: {
            list: vi.fn(async () => []),
          },
          stream,
        },
        storage: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        },
        state: {
          getActiveNoteSummary: vi.fn(),
        },
        events: {
          subscribe: vi.fn(),
        },
        actions: {
          invoke: vi.fn(),
        },
      },
    } as unknown as Window & typeof globalThis & { alt: AltPluginApi };

    await expect(
      createAltFetch()('https://alt-plugin.invalid/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-5.4', messages: [] }),
      }),
    ).rejects.toMatchObject({
      name: 'FORBIDDEN',
      message: 'Plugin AI model is not available',
    });
  });

  it('errors the response stream when the host reports an error after start', async () => {
    const stream = vi.fn(async (_request, handlers) => {
      handlers.onStart({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
      handlers.onChunk(new TextEncoder().encode('partial').buffer);
      handlers.onError({
        code: 'PROXY_ERROR',
        message: 'Plugin AI request failed',
      });
      return { cancel: vi.fn() };
    }) satisfies AltPluginApi['ai']['stream'];

    globalWithWindow.window = {
      alt: {
        ai: {
          models: {
            list: vi.fn(async () => []),
          },
          stream,
        },
        storage: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        },
        state: {
          getActiveNoteSummary: vi.fn(),
        },
        events: {
          subscribe: vi.fn(),
        },
        actions: {
          invoke: vi.fn(),
        },
      },
    } as unknown as Window & typeof globalThis & { alt: AltPluginApi };

    const response = await createAltFetch()(
      'https://alt-plugin.invalid/v1/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify({ model: 'auto', messages: [] }),
      },
    );

    await expect(response.text()).rejects.toMatchObject({
      name: 'PROXY_ERROR',
      message: 'Plugin AI request failed',
    });
  });

  it('rejects unsupported URLs and private model ids before calling the host', async () => {
    const stream = vi.fn(async () => ({
      cancel: vi.fn(),
    })) satisfies AltPluginApi['ai']['stream'];

    globalWithWindow.window = {
      alt: {
        ai: {
          models: {
            list: vi.fn(async () => []),
          },
          stream,
        },
        storage: {
          get: vi.fn(),
          set: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        },
        state: {
          getActiveNoteSummary: vi.fn(),
        },
        events: {
          subscribe: vi.fn(),
        },
        actions: {
          invoke: vi.fn(),
        },
      },
    } as unknown as Window & typeof globalThis & { alt: AltPluginApi };

    await expect(
      createAltFetch()('https://alt-plugin.invalid/v1/embeddings', {
        method: 'POST',
        body: JSON.stringify({ model: 'auto' }),
      }),
    ).rejects.toThrow('Unsupported Alt AI endpoint');
    await expect(
      createAltFetch()('https://alt-plugin.invalid/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify({ model: 'gpt-5.4-mini', messages: [] }),
      }),
    ).rejects.toThrow();
    expect(stream).not.toHaveBeenCalled();
  });
});
