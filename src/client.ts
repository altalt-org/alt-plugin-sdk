import type {
  PluginAction,
  PluginActionPayloadMap,
  PluginActionResultMap,
  PluginActiveNoteSummary,
  PluginAiModelInfo,
  PluginAiStreamHandle,
  PluginAiStreamHandlers,
  PluginAiStreamRequest,
  PluginAppendTranscriptLineParams,
  PluginCreatedNoteSummary,
  PluginCreateFolderParams,
  PluginCreateNotePayload,
  PluginDeleteComponentParams,
  PluginDeleteFolderParams,
  PluginDeleteNoteParams,
  PluginEvent,
  PluginEventData,
  PluginFolderNode,
  PluginGetComponentParams,
  PluginGetMemoParams,
  PluginListComponentsParams,
  PluginMoveFolderParams,
  PluginNoteComponent,
  PluginNoteComponentSummary,
  PluginNoteContent,
  PluginNoteSummary,
  PluginNotesListParams,
  PluginAiCompleteRequest,
  PluginAiCompleteResult,
  PluginAiSummarizeRequest,
  PluginAiSummarizeResult,
  PluginAppSettingKey,
  PluginAppSettingValue,
  PluginAttachFileParams,
  PluginAttachedFile,
  PluginDeleteFileParams,
  PluginListFilesParams,
  PluginReadFileParams,
  PluginReadFileResult,
  PluginRecordingStartParams,
  PluginRecordingStatus,
  PluginRenameFolderParams,
  PluginSdkMethod,
  PluginSelectNotePayload,
  PluginSetMemoParams,
  PluginSetSummaryParams,
  PluginStorageValue,
  PluginTranscribeFileRequest,
  PluginTranscribeNoteRequest,
  PluginTranscriptionStreamHandle,
  PluginTranscriptionStreamHandlers,
  PluginUpdateNoteParams,
  PluginUpsertComponentParams,
} from './contracts.js';

type PluginEventCallback<TEvent extends PluginEvent> = (
  payload: PluginEventData<TEvent>,
) => void;

export interface AltPluginApi {
  storage: {
    get(key: string): Promise<PluginStorageValue | undefined>;
    set(key: string, value: PluginStorageValue): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<Record<string, PluginStorageValue>>;
  };
  state: {
    getActiveNoteSummary(): Promise<PluginActiveNoteSummary | null>;
  };
  events: {
    subscribe<TEvent extends PluginEvent>(
      event: TEvent,
      callback: PluginEventCallback<TEvent>,
    ): Promise<() => Promise<void>>;
  };
  actions: {
    /**
     * @deprecated Use `alt.notes.create()` and `alt.notes.select()` instead.
     * Retained as a shim for plugins built against SDK v0.
     */
    invoke<TAction extends PluginAction>(
      action: TAction,
      payload: PluginActionPayloadMap[TAction],
    ): Promise<PluginActionResultMap[TAction]>;
  };
  ai: {
    models: {
      list(): Promise<PluginAiModelInfo[]>;
    };
    /**
     * @deprecated Use `alt.ai.chat.stream` instead — same call, future-proof name.
     */
    stream(
      request: PluginAiStreamRequest,
      handlers: PluginAiStreamHandlers,
    ): Promise<PluginAiStreamHandle>;
    chat: {
      stream(
        request: PluginAiStreamRequest,
        handlers: PluginAiStreamHandlers,
      ): Promise<PluginAiStreamHandle>;
    };
    /** Non-streaming convenience wrapper. Buffers the stream into a single result. */
    complete(request: PluginAiCompleteRequest): Promise<PluginAiCompleteResult>;
    /**
     * Generate a summary of an Alt note using the same prompt the in-app
     * summarize action uses. The host pulls the note's content and runs it
     * through the configured model.
     */
    summarize(
      request: PluginAiSummarizeRequest,
    ): Promise<PluginAiSummarizeResult>;
  };
  notes: {
    listFolders(): Promise<PluginFolderNode[]>;
    list(params?: PluginNotesListParams): Promise<PluginNoteSummary[]>;
    getContent(noteId: number): Promise<PluginNoteContent>;
    create(payload: PluginCreateNotePayload): Promise<PluginCreatedNoteSummary>;
    select(payload: PluginSelectNotePayload): Promise<{ ok: true }>;
    update(params: PluginUpdateNoteParams): Promise<PluginNoteSummary>;
    delete(params: PluginDeleteNoteParams): Promise<{ ok: true }>;
    setMemo(params: PluginSetMemoParams): Promise<{ componentId: number }>;
    getMemo(params: PluginGetMemoParams): Promise<{ markdown: string }>;
    setSummary(
      params: PluginSetSummaryParams,
    ): Promise<{ componentId: number }>;
    appendTranscriptLine(
      params: PluginAppendTranscriptLineParams,
    ): Promise<{ componentId: number }>;
    listComponents(
      params: PluginListComponentsParams,
    ): Promise<PluginNoteComponentSummary[]>;
    getComponent(
      params: PluginGetComponentParams,
    ): Promise<PluginNoteComponent>;
    upsertComponent(
      params: PluginUpsertComponentParams,
    ): Promise<PluginNoteComponentSummary>;
    deleteComponent(params: PluginDeleteComponentParams): Promise<{ ok: true }>;
  };
  folders: {
    create(params: PluginCreateFolderParams): Promise<PluginFolderNode>;
    rename(params: PluginRenameFolderParams): Promise<PluginFolderNode>;
    move(params: PluginMoveFolderParams): Promise<PluginFolderNode>;
    delete(params: PluginDeleteFolderParams): Promise<{ ok: true }>;
  };
  recording: {
    start(
      params: PluginRecordingStartParams,
    ): Promise<{ ok: true; sessionId: string }>;
    stop(): Promise<{ ok: true }>;
    getStatus(): Promise<PluginRecordingStatus>;
  };
  transcription: {
    transcribeFile(
      request: PluginTranscribeFileRequest,
      handlers: PluginTranscriptionStreamHandlers,
    ): Promise<PluginTranscriptionStreamHandle>;
    transcribeNote(
      request: PluginTranscribeNoteRequest,
      handlers: PluginTranscriptionStreamHandlers,
    ): Promise<PluginTranscriptionStreamHandle>;
  };
  files: {
    attach(params: PluginAttachFileParams): Promise<PluginAttachedFile>;
    list(params: PluginListFilesParams): Promise<PluginAttachedFile[]>;
    read(params: PluginReadFileParams): Promise<PluginReadFileResult>;
    delete(params: PluginDeleteFileParams): Promise<{ ok: true }>;
  };
  settings: {
    /** Returns the value of a curated app-level setting, or null if unset. */
    get(key: PluginAppSettingKey): Promise<PluginAppSettingValue>;
    /** Returns the full curated allowlist with current values. */
    list(): Promise<Record<PluginAppSettingKey, PluginAppSettingValue>>;
  };
}

/** Host UI language code, e.g. `'en'`, `'ko'`, `'de'`. */
export type PluginLocale = string;

/**
 * Read and observe the host's current UI language. A convenience layer over the
 * `language` app setting and the `settingChanged` event — a plugin using it
 * needs the `settings:read` and `events:subscribe` permissions.
 */
export interface AltLocaleApi {
  /** The host's current UI language. Defaults to `'en'` when unset. */
  get(): Promise<PluginLocale>;
  /**
   * Subscribe to host language changes. The callback fires with the new locale
   * each time the user switches the app language. Returns an async unsubscribe.
   */
  onChange(
    callback: (locale: PluginLocale) => void,
  ): Promise<() => Promise<void>>;
}

/** The SDK surface plugins import as `alt` — the host bridge plus SDK helpers. */
export interface AltPluginSdk extends AltPluginApi {
  locale: AltLocaleApi;
}

export interface AltPluginInvokeBridge {
  invoke(method: PluginSdkMethod, params?: unknown): Promise<unknown>;
}

function requireWindowAlt(): AltPluginApi {
  const maybeWindow = (globalThis as { window?: { alt?: AltPluginApi } })
    .window;

  if (!maybeWindow?.alt) {
    throw new Error('Alt plugin SDK is only available inside an Alt plugin');
  }

  return maybeWindow.alt;
}

export function getAlt(): AltPluginApi {
  return requireWindowAlt();
}

export const alt: AltPluginSdk = {
  storage: {
    get: key => getAlt().storage.get(key),
    set: (key, value) => getAlt().storage.set(key, value),
    delete: key => getAlt().storage.delete(key),
    list: () => getAlt().storage.list(),
  },
  state: {
    getActiveNoteSummary: () => getAlt().state.getActiveNoteSummary(),
  },
  events: {
    subscribe: (event, callback) => getAlt().events.subscribe(event, callback),
  },
  actions: {
    invoke: (action, payload) => getAlt().actions.invoke(action, payload),
  },
  ai: {
    models: {
      list: () => getAlt().ai.models.list(),
    },
    stream: (request, handlers) => getAlt().ai.stream(request, handlers),
    chat: {
      stream: (request, handlers) => getAlt().ai.stream(request, handlers),
    },
    complete: request => getAlt().ai.complete(request),
    summarize: request => getAlt().ai.summarize(request),
  },
  notes: {
    listFolders: () => getAlt().notes.listFolders(),
    list: params => getAlt().notes.list(params),
    getContent: noteId => getAlt().notes.getContent(noteId),
    create: payload => getAlt().notes.create(payload),
    select: payload => getAlt().notes.select(payload),
    update: params => getAlt().notes.update(params),
    delete: params => getAlt().notes.delete(params),
    setMemo: params => getAlt().notes.setMemo(params),
    getMemo: params => getAlt().notes.getMemo(params),
    setSummary: params => getAlt().notes.setSummary(params),
    appendTranscriptLine: params => getAlt().notes.appendTranscriptLine(params),
    listComponents: params => getAlt().notes.listComponents(params),
    getComponent: params => getAlt().notes.getComponent(params),
    upsertComponent: params => getAlt().notes.upsertComponent(params),
    deleteComponent: params => getAlt().notes.deleteComponent(params),
  },
  folders: {
    create: params => getAlt().folders.create(params),
    rename: params => getAlt().folders.rename(params),
    move: params => getAlt().folders.move(params),
    delete: params => getAlt().folders.delete(params),
  },
  recording: {
    start: params => getAlt().recording.start(params),
    stop: () => getAlt().recording.stop(),
    getStatus: () => getAlt().recording.getStatus(),
  },
  transcription: {
    transcribeFile: (request, handlers) =>
      getAlt().transcription.transcribeFile(request, handlers),
    transcribeNote: (request, handlers) =>
      getAlt().transcription.transcribeNote(request, handlers),
  },
  files: {
    attach: params => getAlt().files.attach(params),
    list: params => getAlt().files.list(params),
    read: params => getAlt().files.read(params),
    delete: params => getAlt().files.delete(params),
  },
  settings: {
    get: key => getAlt().settings.get(key),
    list: () => getAlt().settings.list(),
  },
  locale: {
    get: async () => {
      const value = await getAlt().settings.get('language');
      return typeof value === 'string' ? value : 'en';
    },
    onChange: callback =>
      getAlt().events.subscribe('settingChanged', ({ key, value }) => {
        if (key === 'language' && typeof value === 'string') {
          callback(value);
        }
      }),
  },
};

declare global {
  interface Window {
    alt: AltPluginApi;
  }
}
