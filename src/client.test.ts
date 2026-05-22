import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AltPluginApi } from './client';
import { alt, getAlt } from './client';

const globalWithWindow = globalThis as unknown as {
  window?: Window &
    typeof globalThis & {
      alt: AltPluginApi;
    };
};

function installMockAlt(): {
  api: AltPluginApi;
  unsubscribe: ReturnType<typeof vi.fn>;
} {
  const unsubscribe = vi.fn(async () => undefined);
  const api: AltPluginApi = {
    storage: {
      get: vi.fn(async key => (key === 'demo' ? 1 : undefined)),
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      list: vi.fn(async () => ({ demo: 1 })),
    },
    state: {
      getActiveNoteSummary: vi.fn(async () => null),
    },
    events: {
      subscribe: vi.fn(async () => unsubscribe),
    },
    actions: {
      invoke: vi.fn(async action => {
        if (action === 'notes.select') {
          return { ok: true as const };
        }

        return {
          id: 10,
          title: 'Created',
          folder_id: null,
          lecture_date: '2026-05-15',
          status: 'draft' as const,
          created_at: '2026-05-15T00:00:00.000Z',
        };
      }) as AltPluginApi['actions']['invoke'],
    },
    ai: {
      models: {
        list: vi.fn(async () => [
          {
            id: 'auto' as const,
            name: 'Auto',
            provider: 'auto' as const,
            supportsTools: true,
            availability: 'ready' as const,
          },
          {
            id: 'local' as const,
            name: 'Local',
            provider: 'local' as const,
            supportsTools: false,
            availability: 'ready' as const,
          },
        ]),
      },
      stream: vi.fn(async (_request, handlers) => {
        handlers.onStart({
          status: 200,
          headers: { 'content-type': 'text/plain' },
        });
        handlers.onChunk(new TextEncoder().encode('ok').buffer);
        handlers.onEnd();
        return { cancel: vi.fn() };
      }),
      chat: {
        stream: vi.fn(async (_request, handlers) => {
          handlers.onStart({
            status: 200,
            headers: { 'content-type': 'text/plain' },
          });
          handlers.onEnd();
          return { cancel: vi.fn() };
        }),
      },
      complete: vi.fn(async () => ({
        text: 'completed',
        finishReason: 'stop' as const,
      })),
      summarize: vi.fn(async () => ({ noteId: 11, text: 'summary' })),
    },
    notes: {
      listFolders: vi.fn(async () => [
        { id: 1, name: 'Math', parentId: null, children: [] },
      ]),
      list: vi.fn(async () => [
        {
          id: 11,
          title: 'Lecture 1',
          folderId: 1,
          status: 'completed' as const,
          createdAt: '2026-05-10T00:00:00.000Z',
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
      ]),
      getContent: vi.fn(async () => ({
        id: 11,
        title: 'Lecture 1',
        transcript: '[0:00] hi',
        memo: '# memo',
        summary: '## summary',
      })),
      create: vi.fn(async () => ({
        id: 99,
        title: 'New',
        folder_id: null,
        lecture_date: '2026-05-15',
        status: 'draft' as const,
        created_at: '2026-05-15T00:00:00.000Z',
      })),
      select: vi.fn(async () => ({ ok: true as const })),
      update: vi.fn(async () => ({
        id: 11,
        title: 'Renamed',
        folderId: null,
        status: 'draft' as const,
        createdAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      })),
      delete: vi.fn(async () => ({ ok: true as const })),
      setMemo: vi.fn(async () => ({ componentId: 5 })),
      getMemo: vi.fn(async () => ({ markdown: '' })),
      setSummary: vi.fn(async () => ({ componentId: 6 })),
      appendTranscriptLine: vi.fn(async () => ({ componentId: 7 })),
      listComponents: vi.fn(async () => []),
      getComponent: vi.fn(async () => ({
        id: 5,
        noteId: 11,
        componentType: 'memo' as const,
        title: 'Memo',
        displayOrder: 0,
        hasFile: false,
        contentText: null,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      })),
      upsertComponent: vi.fn(async () => ({
        id: 8,
        noteId: 11,
        componentType: 'memo' as const,
        title: 'Memo',
        displayOrder: 0,
        hasFile: false,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      })),
      deleteComponent: vi.fn(async () => ({ ok: true as const })),
    },
    folders: {
      create: vi.fn(async () => ({
        id: 1,
        name: 'New',
        parentId: null,
        children: [],
      })),
      rename: vi.fn(async () => ({
        id: 1,
        name: 'Renamed',
        parentId: null,
        children: [],
      })),
      move: vi.fn(async () => ({
        id: 1,
        name: 'Moved',
        parentId: 2,
        children: [],
      })),
      delete: vi.fn(async () => ({ ok: true as const })),
    },
    recording: {
      start: vi.fn(async () => ({ ok: true as const, sessionId: 'sess-1' })),
      stop: vi.fn(async () => ({ ok: true as const })),
      getStatus: vi.fn(async () => ({
        status: 'idle' as const,
        noteId: null,
        durationMs: 0,
      })),
    },
    transcription: {
      transcribeFile: vi.fn(async () => ({ cancel: vi.fn() })),
      transcribeNote: vi.fn(async () => ({ cancel: vi.fn() })),
    },
    files: {
      attach: vi.fn(async () => ({
        componentId: 1,
        fileId: 2,
        fileName: 'f.bin',
        mimeType: 'application/octet-stream',
        sizeBytes: 10,
      })),
      list: vi.fn(async () => []),
      read: vi.fn(async () => ({
        fileName: 'f.bin',
        mimeType: null,
        sizeBytes: 0,
        data: new ArrayBuffer(0),
      })),
      delete: vi.fn(async () => ({ ok: true as const })),
    },
    settings: {
      get: vi.fn(async () => 'system'),
      list: vi.fn(async () => ({
        theme: 'system',
        language: 'en',
        'transcription.lectureLanguage': null,
        'transcription.diarizationEnabled': false,
        'transcription.includeSystemAudio': false,
      })),
    },
  };

  globalWithWindow.window = { alt: api } as Window &
    typeof globalThis & { alt: AltPluginApi };
  return { api, unsubscribe };
}

describe('alt-plugin-sdk client', () => {
  afterEach(() => {
    delete globalWithWindow.window;
  });

  it('returns the host-provided window.alt object', () => {
    const { api } = installMockAlt();

    expect(getAlt()).toBe(api);
  });

  it('forwards storage, state, and action calls to window.alt', async () => {
    const { api } = installMockAlt();

    await expect(alt.storage.get('demo')).resolves.toBe(1);
    await alt.storage.set('demo', { nested: true });
    await expect(alt.state.getActiveNoteSummary()).resolves.toBeNull();
    await expect(
      alt.actions.invoke('notes.select', { noteId: 123 }),
    ).resolves.toEqual({ ok: true });

    expect(api.storage.get).toHaveBeenCalledWith('demo');
    expect(api.storage.set).toHaveBeenCalledWith('demo', { nested: true });
    expect(api.state.getActiveNoteSummary).toHaveBeenCalledWith();
    expect(api.actions.invoke).toHaveBeenCalledWith('notes.select', {
      noteId: 123,
    });
  });

  it('preserves event unsubscribe behavior from the host API', async () => {
    const { api, unsubscribe } = installMockAlt();
    const callback = vi.fn();

    const stop = await alt.events.subscribe('activeNoteChanged', callback);
    await stop();

    expect(api.events.subscribe).toHaveBeenCalledWith(
      'activeNoteChanged',
      callback,
    );
    expect(unsubscribe).toHaveBeenCalledWith();
  });

  it('forwards notes calls to window.alt with the original parameters', async () => {
    const { api } = installMockAlt();

    await expect(alt.notes.listFolders()).resolves.toEqual([
      expect.objectContaining({ id: 1, name: 'Math' }),
    ]);
    await expect(
      alt.notes.list({ folderId: 1, query: 'wave', limit: 25 }),
    ).resolves.toEqual([expect.objectContaining({ id: 11 })]);
    await expect(alt.notes.getContent(11)).resolves.toMatchObject({
      id: 11,
      title: 'Lecture 1',
    });

    expect(api.notes.listFolders).toHaveBeenCalledWith();
    expect(api.notes.list).toHaveBeenCalledWith({
      folderId: 1,
      query: 'wave',
      limit: 25,
    });
    expect(api.notes.getContent).toHaveBeenCalledWith(11);
  });

  it('forwards first-class notes.create and notes.select calls', async () => {
    const { api } = installMockAlt();

    await expect(
      alt.notes.create({ title: 'New Note', folderId: 2 }),
    ).resolves.toMatchObject({ id: 99, title: 'New' });
    await expect(alt.notes.select({ noteId: 11 })).resolves.toEqual({
      ok: true,
    });

    expect(api.notes.create).toHaveBeenCalledWith({
      title: 'New Note',
      folderId: 2,
    });
    expect(api.notes.select).toHaveBeenCalledWith({ noteId: 11 });
  });

  it('alt.ai.chat.stream and alt.ai.stream are aliases that hit the same host bridge', async () => {
    const { api } = installMockAlt();
    const handlers = {
      onStart: vi.fn(),
      onChunk: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };
    const request = {
      requestId: 'ai-2',
      endpoint: 'chat.completions' as const,
      model: 'auto' as const,
      method: 'POST' as const,
      headers: {},
      body: JSON.stringify({ messages: [] }),
    };
    await alt.ai.chat.stream(request, handlers);
    await alt.ai.stream(request, handlers);
    // Both paths route through window.alt.ai.stream — chat.stream is just the
    // preferred public name; .stream survives as the deprecated alias.
    expect(api.ai.stream).toHaveBeenCalledTimes(2);
  });

  it('alt.ai.complete and alt.ai.summarize forward to window.alt', async () => {
    const { api } = installMockAlt();
    await expect(
      alt.ai.complete({
        requestId: 'c1',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    ).resolves.toMatchObject({ text: 'completed' });
    await expect(alt.ai.summarize({ noteId: 11 })).resolves.toEqual({
      noteId: 11,
      text: 'summary',
    });
    expect(api.ai.complete).toHaveBeenCalled();
    expect(api.ai.summarize).toHaveBeenCalledWith({ noteId: 11 });
  });

  it('forwards AI model listing and streams through window.alt', async () => {
    const { api } = installMockAlt();
    const handlers = {
      onStart: vi.fn(),
      onChunk: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    };

    await expect(alt.ai.models.list()).resolves.toEqual([
      expect.objectContaining({ id: 'auto', name: 'Auto' }),
      expect.objectContaining({ id: 'local', name: 'Local' }),
    ]);
    await alt.ai.stream(
      {
        requestId: 'ai-1',
        endpoint: 'chat.completions',
        model: 'auto',
        method: 'POST',
        headers: {},
        body: JSON.stringify({ model: 'auto', messages: [] }),
      },
      handlers,
    );

    expect(api.ai.models.list).toHaveBeenCalledWith();
    expect(api.ai.stream).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'auto' }),
      handlers,
    );
    expect(handlers.onChunk).toHaveBeenCalled();
  });
});
