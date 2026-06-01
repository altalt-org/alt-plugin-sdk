import { z } from 'zod';

/**
 * Major version of the plugin SDK that this host understands.
 * A plugin whose manifest declares a higher major refuses to load.
 */
export const PLUGIN_HOST_SDK_MAJOR = 1;

export const pluginPermissionSchema = z.enum([
  'storage',
  'appState:read',
  'events:subscribe',
  'ai:chat',
  'notes:read',
  // Write surfaces (Phase 2+). `actions:notes` is the legacy permission that
  // pre-dates the split — granted plugins are migrated at runtime to
  // `notes:write` + `notes:select` (see the host's effective-permission set).
  'actions:notes',
  'notes:write',
  'notes:select',
  'folders:write',
  'recording:control',
  'transcription:run',
  'files:read',
  'files:write',
  'settings:read',
  'settings:write',
]);

export const pluginEventSchema = z.enum([
  'activeNoteChanged',
  'recordingStatusChanged',
  'recordingLevel',
  'transcriptUpdated',
  'noteCreated',
  'noteUpdated',
  'noteDeleted',
  'folderCreated',
  'folderUpdated',
  'folderDeleted',
  'componentUpdated',
  'settingChanged',
]);

/**
 * @deprecated Use the first-class methods `alt.notes.create()` / `alt.notes.select()`.
 * Kept as a backwards-compatibility shim for plugins built against SDK v0.
 */
export const pluginActionSchema = z.enum(['notes.select', 'notes.create']);

const sdkVersionRegex = /^\d+(?:\.\d+){0,2}$/;

/**
 * Per-locale overrides for the user-facing manifest fields. The top-level
 * `name`/`description` remain the default (fallback) values; an entry here
 * overrides them for a specific locale.
 */
export const pluginManifestLocaleSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});
export type PluginManifestLocale = z.infer<typeof pluginManifestLocaleSchema>;

/**
 * Stable marketplace category keys. The label shown to users is localized by
 * the consumer (landing site / in-app marketplace), NOT stored per-plugin — keep
 * this list in sync with the marketplace's category-label dictionaries.
 */
export const pluginCategorySchema = z.enum([
  'productivity',
  'education',
  'writing',
  'research',
  'developer',
  'ai',
  'media',
  'utilities',
]);
export type PluginCategory = z.infer<typeof pluginCategorySchema>;

/** Per-locale overrides for the marketplace listing copy. */
export const pluginMarketplaceLocaleSchema = z.object({
  longDescription: z.string().max(4000).optional(),
});
export type PluginMarketplaceLocale = z.infer<
  typeof pluginMarketplaceLocaleSchema
>;

/**
 * Optional store-listing metadata. The Alt host ignores this block at load time
 * (it only needs the run-time fields); the marketplace reads it to populate the
 * plugin's detail page. `screenshots` are bundle-relative paths resolved against
 * the same root as `entry`/`icon`. `name`/`description` localization stays in
 * the top-level {@link pluginManifestSchema.locales}; only `longDescription`
 * is localized here.
 */
export const pluginMarketplaceSchema = z.object({
  category: pluginCategorySchema.optional(),
  longDescription: z.string().max(4000).optional(),
  screenshots: z.array(z.string().min(1).max(260)).max(8).optional(),
  locales: z
    .record(z.string().min(2).max(35), pluginMarketplaceLocaleSchema)
    .optional(),
});
export type PluginMarketplace = z.infer<typeof pluginMarketplaceSchema>;

export const pluginManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9._-]*$/),
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(80),
  entry: z.string().min(1).max(260),
  permissions: z.array(pluginPermissionSchema).default([]),
  description: z.string().max(500).optional(),
  author: z.string().max(120).optional(),
  icon: z.string().max(260).optional(),
  /**
   * Optional localized overrides for `name`/`description`, keyed by locale code
   * (e.g. `'ko'`, `'de'`). Any locale may be supplied — the host resolves the
   * ones it understands and falls back to the top-level fields otherwise.
   */
  locales: z
    .record(z.string().min(2).max(35), pluginManifestLocaleSchema)
    .optional(),
  /**
   * Optional marketplace listing metadata (category, long description,
   * screenshots, localized copy). Ignored by the host at load time; consumed by
   * the plugin marketplace. See {@link pluginMarketplaceSchema}.
   */
  marketplace: pluginMarketplaceSchema.optional(),
  /**
   * SDK major (or major.minor[.patch]) this plugin was built against.
   * The host refuses to load a plugin whose major exceeds {@link PLUGIN_HOST_SDK_MAJOR}.
   * Defaults to `'1'` for plugins authored before this field existed.
   */
  sdkVersion: z
    .string()
    .regex(sdkVersionRegex)
    .default(String(PLUGIN_HOST_SDK_MAJOR)),
});

/**
 * Parse the major number out of a sdkVersion string. Returns NaN for malformed
 * input — callers should treat NaN as "incompatible".
 */
export function parsePluginSdkMajor(sdkVersion: string): number {
  const [majorPart] = sdkVersion.split('.');
  const major = Number.parseInt(majorPart ?? '', 10);
  return Number.isFinite(major) ? major : Number.NaN;
}

/**
 * `actions:notes` was a single permission that gated both note creation and
 * selection. The new split surface uses `notes:write` and `notes:select`.
 * Existing plugins are migrated at runtime by expanding the legacy grant.
 */
export function expandLegacyPermissions(
  granted: readonly PluginPermission[],
): PluginPermission[] {
  const set = new Set<PluginPermission>(granted);
  if (set.has('actions:notes')) {
    set.add('notes:write');
    set.add('notes:select');
  }
  return [...set];
}

export type PluginPermission = z.infer<typeof pluginPermissionSchema>;
export type PluginEvent = z.infer<typeof pluginEventSchema>;
export type PluginAction = z.infer<typeof pluginActionSchema>;
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginManifestInput = z.input<typeof pluginManifestSchema>;

/**
 * Resolve a manifest's user-facing `name`/`description` for a target locale.
 * Tries the exact locale, then its language part (`ko-KR` → `ko`), then falls
 * back to the top-level default fields. Each field falls back independently, so
 * a locale that overrides only `name` still inherits the default description.
 */
export function resolveLocalizedManifest(
  manifest: Pick<PluginManifest, 'name' | 'description' | 'locales'>,
  locale: string,
): { name: string; description: string | undefined } {
  const language = locale.split('-')[0] ?? locale;
  const override = manifest.locales?.[locale] ?? manifest.locales?.[language];
  return {
    name: override?.name ?? manifest.name,
    description: override?.description ?? manifest.description,
  };
}

export type PluginStorageValue =
  | string
  | number
  | boolean
  | null
  | PluginStorageValue[]
  | { [key: string]: PluginStorageValue };

export const pluginStorageValueSchema: z.ZodType<PluginStorageValue> = z.lazy(
  () =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(pluginStorageValueSchema),
      z.record(z.string(), pluginStorageValueSchema),
    ]),
);

export const pluginStorageKeySchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9._:-]+$/);

export const pluginSdkMethodSchema = z.enum([
  'storage:get',
  'storage:set',
  'storage:delete',
  'storage:list',
  'state:getActiveNoteSummary',
  'events:subscribe',
  'events:unsubscribe',
  // Legacy dispatch — routes to notes:create / notes:select internally.
  // @deprecated Use the first-class methods.
  'actions:invoke',
  'ai:models:list',
  'notes:listFolders',
  'notes:list',
  'notes:getContent',
  // First-class note create/select (Phase 1 promotion of the legacy actions).
  'notes:create',
  'notes:select',
  // Notes write surface (Phase 2).
  'notes:update',
  'notes:delete',
  'notes:setMemo',
  'notes:getMemo',
  'notes:setSummary',
  'notes:appendTranscriptLine',
  'notes:listComponents',
  'notes:getComponent',
  'notes:upsertComponent',
  'notes:deleteComponent',
  // Folders write surface (Phase 2).
  'folders:create',
  'folders:rename',
  'folders:move',
  'folders:delete',
  // Recording control (Phase 3). Pause/resume intentionally omitted — the
  // underlying RecordingOrchestrator doesn't support them today.
  'recording:start',
  'recording:stop',
  'recording:getStatus',
  // AI parity (Phase 4). `ai:summarize` runs on the host so plugins inherit
  // Alt's built-in prompt template; `ai.complete` is implemented client-side
  // by buffering an ai.stream response, so it has no enum entry of its own.
  'ai:summarize',
  // Files (Phase 5). File-based note components only — Alt's data model has
  // no notion of a free-standing plugin file outside the note graph.
  'files:attach',
  'files:list',
  'files:read',
  'files:delete',
  // Settings (Phase 5). Plugins read a curated allowlist of app settings;
  // their own private state lives in `alt.storage`, not here.
  'settings:get',
  'settings:list',
]);

export type PluginSdkMethod = z.infer<typeof pluginSdkMethodSchema>;

export const pluginSdkInvokeRequestSchema = z.object({
  requestId: z.string().min(1).max(120),
  method: pluginSdkMethodSchema,
  params: z.unknown().optional(),
});

export type PluginSdkInvokeRequest = z.infer<
  typeof pluginSdkInvokeRequestSchema
>;

export const pluginAiModelIdSchema = z.enum(['gpt-5.4', 'auto', 'local']);
export const pluginAiModelProviderSchema = z.enum(['cloud', 'auto', 'local']);
export const pluginAiModelAvailabilitySchema = z.enum(['ready', 'unavailable']);
export const pluginAiEndpointSchema = z.enum(['chat.completions']);

export type PluginAiModelId = z.infer<typeof pluginAiModelIdSchema>;
export type PluginAiModelProvider = z.infer<typeof pluginAiModelProviderSchema>;
export type PluginAiModelAvailability = z.infer<
  typeof pluginAiModelAvailabilitySchema
>;
export type PluginAiEndpoint = z.infer<typeof pluginAiEndpointSchema>;

export const pluginAiModelInfoSchema = z.object({
  id: pluginAiModelIdSchema,
  name: z.string().min(1).max(80),
  provider: pluginAiModelProviderSchema,
  supportsTools: z.boolean(),
  availability: pluginAiModelAvailabilitySchema,
});

export type PluginAiModelInfo = z.infer<typeof pluginAiModelInfoSchema>;

export const pluginAiStreamRequestSchema = z.object({
  requestId: z.string().min(1).max(120),
  endpoint: pluginAiEndpointSchema,
  model: pluginAiModelIdSchema.default('auto'),
  method: z.literal('POST'),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().min(1).max(1_000_000),
});

export type PluginAiStreamRequest = z.infer<typeof pluginAiStreamRequestSchema>;

export const pluginAiStreamStartSchema = z.object({
  status: z.number().int().min(100).max(599),
  headers: z.record(z.string(), z.string()),
});

export type PluginAiStreamStart = z.infer<typeof pluginAiStreamStartSchema>;

export const pluginAiStreamErrorCodeSchema = z.enum([
  'FORBIDDEN',
  'MODEL_UNAVAILABLE',
  'INVALID_REQUEST',
  'PROXY_ERROR',
]);

export type PluginAiStreamErrorCode = z.infer<
  typeof pluginAiStreamErrorCodeSchema
>;

export const pluginAiStreamErrorSchema = z.object({
  code: pluginAiStreamErrorCodeSchema,
  message: z.string().min(1).max(300),
});

export type PluginAiStreamError = z.infer<typeof pluginAiStreamErrorSchema>;

export interface PluginAiStreamHandlers {
  onStart(meta: PluginAiStreamStart): void;
  onChunk(chunk: ArrayBuffer): void;
  onEnd(): void;
  onError(error: PluginAiStreamError): void;
}

export interface PluginAiStreamHandle {
  cancel(): void;
}

export const pluginActionInvokeParamsSchema = z.object({
  action: pluginActionSchema,
  payload: z.unknown().optional(),
});

export const pluginSelectNotePayloadSchema = z.object({
  noteId: z.number().int().positive(),
});

export const pluginCreateNotePayloadSchema = z.object({
  title: z.string().min(1).max(200),
  folderId: z.number().int().positive().nullable().optional(),
});

export type PluginSelectNotePayload = z.infer<
  typeof pluginSelectNotePayloadSchema
>;
export type PluginCreateNotePayload = z.infer<
  typeof pluginCreateNotePayloadSchema
>;

export interface PluginActiveNoteSummary {
  id: number;
  title: string;
  status: 'draft' | 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface PluginCreatedNoteSummary {
  id?: number;
  title: string;
  folder_id: number | null;
  lecture_date: string;
  status: 'draft' | 'in_progress' | 'completed';
  created_at: string;
  updated_at?: string;
}

export interface PluginActionPayloadMap {
  'notes.select': PluginSelectNotePayload;
  'notes.create': PluginCreateNotePayload;
}

export interface PluginActionResultMap {
  'notes.select': { ok: true };
  'notes.create': PluginCreatedNoteSummary;
}

export const pluginRecordingPhaseSchema = z.enum([
  'idle',
  'recording',
  'paused',
]);
export type PluginRecordingPhase = z.infer<typeof pluginRecordingPhaseSchema>;

export const pluginRecordingStatusSchema = z.object({
  status: pluginRecordingPhaseSchema,
  noteId: z.number().int().positive().nullable(),
  durationMs: z.number().int().nonnegative(),
});
export type PluginRecordingStatus = z.infer<typeof pluginRecordingStatusSchema>;

export const pluginRecordingLevelSchema = z.object({
  micDb: z.number(),
  systemDb: z.number(),
  timestamp: z.number().int().nonnegative(),
});
export type PluginRecordingLevel = z.infer<typeof pluginRecordingLevelSchema>;

export type PluginHostEventPayload =
  | {
      event: 'activeNoteChanged';
      data: PluginActiveNoteSummary | null;
    }
  | {
      event: 'recordingStatusChanged';
      data: PluginRecordingStatus;
    }
  | {
      event: 'recordingLevel';
      data: PluginRecordingLevel;
    }
  | {
      event: 'transcriptUpdated';
      data: { noteId: number };
    }
  | {
      event: 'noteCreated';
      data: PluginNoteSummary;
    }
  | {
      event: 'noteUpdated';
      data: PluginNoteSummary;
    }
  | {
      event: 'noteDeleted';
      data: { noteId: number };
    }
  | {
      event: 'folderCreated';
      data: PluginFolderNode;
    }
  | {
      event: 'folderUpdated';
      data: PluginFolderNode;
    }
  | {
      event: 'folderDeleted';
      data: { folderId: number };
    }
  | {
      event: 'componentUpdated';
      data: PluginNoteComponentSummary;
    }
  | {
      event: 'settingChanged';
      data: { key: PluginAppSettingKey; value: PluginAppSettingValue };
    };

export type PluginEventData<TEvent extends PluginEvent> = Extract<
  PluginHostEventPayload,
  { event: TEvent }
>['data'];

export const pluginNoteStatusSchema = z.enum([
  'draft',
  'in_progress',
  'completed',
]);
export type PluginNoteStatus = z.infer<typeof pluginNoteStatusSchema>;

export const pluginNoteSummarySchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  folderId: z.number().int().positive().nullable(),
  status: pluginNoteStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PluginNoteSummary = z.infer<typeof pluginNoteSummarySchema>;

export interface PluginFolderNode {
  id: number;
  name: string;
  parentId: number | null;
  children: PluginFolderNode[];
}

export const pluginFolderNodeSchema: z.ZodType<PluginFolderNode> = z.lazy(() =>
  z.object({
    id: z.number().int().positive(),
    name: z.string(),
    parentId: z.number().int().positive().nullable(),
    children: z.array(pluginFolderNodeSchema),
  }),
);

export const PLUGIN_NOTES_LIST_MAX_LIMIT = 200;
export const PLUGIN_NOTES_LIST_DEFAULT_LIMIT = 50;

export const pluginNotesListParamsSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  query: z.string().max(200).optional(),
  limit: z
    .number()
    .int()
    .positive()
    .max(PLUGIN_NOTES_LIST_MAX_LIMIT)
    .optional(),
});

export type PluginNotesListParams = z.infer<typeof pluginNotesListParamsSchema>;

export const pluginNoteContentSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  transcript: z.string(),
  memo: z.string(),
  summary: z.string(),
});

export type PluginNoteContent = z.infer<typeof pluginNoteContentSchema>;

export const pluginGetNoteContentParamsSchema = z.object({
  noteId: z.number().int().positive(),
});

export type PluginGetNoteContentParams = z.infer<
  typeof pluginGetNoteContentParamsSchema
>;

/**
 * Plugin-visible note component summary. Mirrors the shape exposed by the
 * `componentUpdated` event so plugins can react to changes without re-listing.
 *
 * `componentType` lists every component the database supports today; new
 * types may be added in future migrations and should be treated as opaque
 * by plugins that don't recognize them.
 */
export const pluginNoteComponentTypeSchema = z.enum([
  'slides',
  'recording',
  'memo',
  'transcript',
  'summary',
  'slide_summary',
  'meeting_notes',
  'slide_memo',
]);

export type PluginNoteComponentType = z.infer<
  typeof pluginNoteComponentTypeSchema
>;

export const pluginNoteComponentSummarySchema = z.object({
  id: z.number().int().positive(),
  noteId: z.number().int().positive(),
  componentType: pluginNoteComponentTypeSchema,
  title: z.string(),
  displayOrder: z.number().int().nonnegative(),
  hasFile: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PluginNoteComponentSummary = z.infer<
  typeof pluginNoteComponentSummarySchema
>;

// ============================================================
// Phase 2: notes + folders write surface
// ============================================================

export const pluginUpdateNoteParamsSchema = z.object({
  noteId: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  status: pluginNoteStatusSchema.optional(),
  folderId: z.number().int().positive().nullable().optional(),
});
export type PluginUpdateNoteParams = z.infer<
  typeof pluginUpdateNoteParamsSchema
>;

export const pluginDeleteNoteParamsSchema = z.object({
  noteId: z.number().int().positive(),
});
export type PluginDeleteNoteParams = z.infer<
  typeof pluginDeleteNoteParamsSchema
>;

const markdownBody = z.string().max(500_000);

export const pluginSetMemoParamsSchema = z.object({
  noteId: z.number().int().positive(),
  markdown: markdownBody,
});
export type PluginSetMemoParams = z.infer<typeof pluginSetMemoParamsSchema>;

export const pluginGetMemoParamsSchema = z.object({
  noteId: z.number().int().positive(),
});
export type PluginGetMemoParams = z.infer<typeof pluginGetMemoParamsSchema>;

export const pluginSetSummaryParamsSchema = z.object({
  noteId: z.number().int().positive(),
  markdown: markdownBody,
});
export type PluginSetSummaryParams = z.infer<
  typeof pluginSetSummaryParamsSchema
>;

/**
 * Single transcript line to append. Times are in milliseconds relative to the
 * start of the note's recording. End is optional — when omitted, the line is
 * treated as a point-in-time annotation rather than a duration.
 */
export const pluginAppendTranscriptLineParamsSchema = z.object({
  noteId: z.number().int().positive(),
  text: z.string().min(1).max(10_000),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative().optional(),
  speaker: z.string().max(120).optional(),
});
export type PluginAppendTranscriptLineParams = z.infer<
  typeof pluginAppendTranscriptLineParamsSchema
>;

export const pluginListComponentsParamsSchema = z.object({
  noteId: z.number().int().positive(),
});
export type PluginListComponentsParams = z.infer<
  typeof pluginListComponentsParamsSchema
>;

export const pluginGetComponentParamsSchema = z.object({
  componentId: z.number().int().positive(),
});
export type PluginGetComponentParams = z.infer<
  typeof pluginGetComponentParamsSchema
>;

/**
 * Plugin-visible note component, including raw content_text. Read-only — to
 * mutate, use the type-specific methods (setMemo, setSummary, appendTranscriptLine)
 * or upsertComponent for new text-based components.
 */
export const pluginNoteComponentSchema =
  pluginNoteComponentSummarySchema.extend({
    contentText: z.string().nullable(),
  });
export type PluginNoteComponent = z.infer<typeof pluginNoteComponentSchema>;

/**
 * Text-based component types that plugins can create directly. File-based
 * components (slides, recording) must go through `alt.files.attach` instead.
 */
export const pluginUpsertableComponentTypeSchema = z.enum([
  'memo',
  'summary',
  'transcript',
  'slide_summary',
  'meeting_notes',
]);
export type PluginUpsertableComponentType = z.infer<
  typeof pluginUpsertableComponentTypeSchema
>;

export const pluginUpsertComponentParamsSchema = z.object({
  noteId: z.number().int().positive(),
  componentId: z.number().int().positive().optional(),
  componentType: pluginUpsertableComponentTypeSchema,
  title: z.string().min(1).max(200),
  contentText: z.string().max(1_000_000),
  displayOrder: z.number().int().nonnegative().optional(),
});
export type PluginUpsertComponentParams = z.infer<
  typeof pluginUpsertComponentParamsSchema
>;

export const pluginDeleteComponentParamsSchema = z.object({
  componentId: z.number().int().positive(),
});
export type PluginDeleteComponentParams = z.infer<
  typeof pluginDeleteComponentParamsSchema
>;

// --- Folders ---

export const pluginCreateFolderParamsSchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.number().int().positive().nullable().optional(),
});
export type PluginCreateFolderParams = z.infer<
  typeof pluginCreateFolderParamsSchema
>;

export const pluginRenameFolderParamsSchema = z.object({
  folderId: z.number().int().positive(),
  name: z.string().min(1).max(200),
});
export type PluginRenameFolderParams = z.infer<
  typeof pluginRenameFolderParamsSchema
>;

export const pluginMoveFolderParamsSchema = z.object({
  folderId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable(),
});
export type PluginMoveFolderParams = z.infer<
  typeof pluginMoveFolderParamsSchema
>;

export const pluginDeleteFolderParamsSchema = z.object({
  folderId: z.number().int().positive(),
});
export type PluginDeleteFolderParams = z.infer<
  typeof pluginDeleteFolderParamsSchema
>;

// ============================================================
// Phase 3: recording + transcription
// ============================================================

export const pluginRecordingStartParamsSchema = z.object({
  noteId: z.number().int().positive(),
  /** BCP-47 language code; falls back to the user's transcription setting. */
  lectureLanguage: z.string().min(2).max(10).optional(),
  targetTranslationLanguage: z.string().min(2).max(10).nullable().optional(),
  includeSystemAudio: z.boolean().optional(),
  selectedDeviceId: z.string().max(200).optional(),
});
export type PluginRecordingStartParams = z.infer<
  typeof pluginRecordingStartParamsSchema
>;

/** Single segment of transcribed audio in milliseconds. */
export const pluginTranscriptionSegmentSchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string(),
  speaker: z.string().optional(),
});
export type PluginTranscriptionSegment = z.infer<
  typeof pluginTranscriptionSegmentSchema
>;

export const pluginTranscribeFileRequestSchema = z.object({
  requestId: z.string().min(1).max(120),
  filePath: z.string().min(1).max(4096),
  /** BCP-47 language; default falls back to the user's transcription setting. */
  language: z.string().min(2).max(10).optional(),
  diarization: z.boolean().optional(),
});
export type PluginTranscribeFileRequest = z.infer<
  typeof pluginTranscribeFileRequestSchema
>;

export const pluginTranscribeNoteRequestSchema = z.object({
  requestId: z.string().min(1).max(120),
  noteId: z.number().int().positive(),
  language: z.string().min(2).max(10).optional(),
  diarization: z.boolean().optional(),
});
export type PluginTranscribeNoteRequest = z.infer<
  typeof pluginTranscribeNoteRequestSchema
>;

export const pluginTranscriptionStartSchema = z.object({
  /** Total audio duration in milliseconds, or null when ffprobe couldn't determine it. */
  durationMs: z.number().int().nonnegative().nullable(),
});
export type PluginTranscriptionStart = z.infer<
  typeof pluginTranscriptionStartSchema
>;

export const pluginTranscriptionProgressSchema = z.object({
  /** 0..1 — fraction of the source audio decoded so far. */
  fraction: z.number().min(0).max(1),
});
export type PluginTranscriptionProgress = z.infer<
  typeof pluginTranscriptionProgressSchema
>;

export const pluginTranscriptionStreamErrorCodeSchema = z.enum([
  'FORBIDDEN',
  'INVALID_REQUEST',
  'RECORDING_ACTIVE',
  'FILE_UNAVAILABLE',
  'PIPELINE_ERROR',
]);
export type PluginTranscriptionStreamErrorCode = z.infer<
  typeof pluginTranscriptionStreamErrorCodeSchema
>;

export const pluginTranscriptionStreamErrorSchema = z.object({
  code: pluginTranscriptionStreamErrorCodeSchema,
  message: z.string().min(1).max(300),
});
export type PluginTranscriptionStreamError = z.infer<
  typeof pluginTranscriptionStreamErrorSchema
>;

export interface PluginTranscriptionStreamHandlers {
  onStart(meta: PluginTranscriptionStart): void;
  onSegment(segment: PluginTranscriptionSegment): void;
  onProgress(progress: PluginTranscriptionProgress): void;
  onEnd(result: { segments: PluginTranscriptionSegment[] }): void;
  onError(error: PluginTranscriptionStreamError): void;
}

export interface PluginTranscriptionStreamHandle {
  cancel(): void;
}

// ============================================================
// Phase 4: AI parity (no embeddings — Alt has no embedding model)
// ============================================================

export const pluginAiChatMessageRoleSchema = z.enum([
  'system',
  'user',
  'assistant',
]);
export type PluginAiChatMessageRole = z.infer<
  typeof pluginAiChatMessageRoleSchema
>;

export const pluginAiChatMessageSchema = z.object({
  role: pluginAiChatMessageRoleSchema,
  content: z.string().max(500_000),
});
export type PluginAiChatMessage = z.infer<typeof pluginAiChatMessageSchema>;

export const pluginAiCompleteRequestSchema = z.object({
  requestId: z.string().min(1).max(120),
  model: pluginAiModelIdSchema.default('auto'),
  messages: z.array(pluginAiChatMessageSchema).min(1).max(200),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(32_000).optional(),
  /**
   * Pass-through tool definitions. Only honored when the chosen model's
   * `supportsTools` is true; ignored for the local model.
   */
  tools: z.array(z.unknown()).max(64).optional(),
});
// `z.input` keeps the defaulted `model` field optional from the plugin's
// perspective — `.infer` would mark it required because the schema runs the
// default during parsing.
export type PluginAiCompleteRequest = z.input<
  typeof pluginAiCompleteRequestSchema
>;

export const pluginAiCompleteResultSchema = z.object({
  text: z.string(),
  finishReason: z.string().nullable(),
  toolCalls: z.array(z.unknown()).optional(),
});
export type PluginAiCompleteResult = z.infer<
  typeof pluginAiCompleteResultSchema
>;

/**
 * Plugin-facing summarize request. The host pulls the note's transcript and
 * existing memo, runs them through Alt's built-in summarize prompt, and
 * returns the final markdown.
 */
export const pluginAiSummarizeRequestSchema = z.object({
  noteId: z.number().int().positive(),
  /** Optional free-form additional instruction appended to the user prompt. */
  style: z.string().max(500).optional(),
  /** BCP-47 / human-readable language label, passed straight to the prompt. */
  outputLanguage: z.string().max(40).optional(),
  /** Model selection mirrors {@link pluginAiModelIdSchema}; defaults to `'auto'`. */
  model: pluginAiModelIdSchema.default('auto'),
});
export type PluginAiSummarizeRequest = z.input<
  typeof pluginAiSummarizeRequestSchema
>;

export const pluginAiSummarizeResultSchema = z.object({
  noteId: z.number().int().positive(),
  text: z.string(),
});
export type PluginAiSummarizeResult = z.infer<
  typeof pluginAiSummarizeResultSchema
>;

// ============================================================
// Phase 5: files + settings
// ============================================================

/**
 * File-based component types a plugin can attach. Mirrors the database
 * constraint — only these two component_types may carry a file_inode.
 */
export const pluginAttachableComponentTypeSchema = z.enum([
  'slides',
  'recording',
]);
export type PluginAttachableComponentType = z.infer<
  typeof pluginAttachableComponentTypeSchema
>;

export const pluginAttachFileParamsSchema = z.object({
  noteId: z.number().int().positive(),
  fileName: z.string().min(1).max(260),
  /** Cap matches the lecture recording size limit (~256 MB). */
  data: z
    .instanceof(ArrayBuffer)
    .refine(
      buf => buf.byteLength <= 256 * 1024 * 1024,
      'File data exceeds 256 MB',
    ),
  mimeType: z.string().max(120).optional(),
  componentType: pluginAttachableComponentTypeSchema,
  title: z.string().min(1).max(200).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});
export type PluginAttachFileParams = z.input<
  typeof pluginAttachFileParamsSchema
>;

export const pluginAttachedFileSchema = z.object({
  componentId: z.number().int().positive(),
  fileId: z.number().int().positive(),
  fileName: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
});
export type PluginAttachedFile = z.infer<typeof pluginAttachedFileSchema>;

export const pluginListFilesParamsSchema = z.object({
  noteId: z.number().int().positive(),
});
export type PluginListFilesParams = z.infer<typeof pluginListFilesParamsSchema>;

export const pluginReadFileParamsSchema = z.object({
  fileId: z.number().int().positive(),
});
export type PluginReadFileParams = z.infer<typeof pluginReadFileParamsSchema>;

export const pluginReadFileResultSchema = z.object({
  fileName: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  data: z.instanceof(ArrayBuffer),
});
export type PluginReadFileResult = z.infer<typeof pluginReadFileResultSchema>;

export const pluginDeleteFileParamsSchema = z.object({
  componentId: z.number().int().positive(),
});
export type PluginDeleteFileParams = z.infer<
  typeof pluginDeleteFileParamsSchema
>;

// --- Settings ---

/**
 * Curated set of app-level setting keys plugins can read. Adding keys here
 * is an explicit API decision — anything not listed is intentionally hidden
 * from plugins.
 */
export const pluginAppSettingKeySchema = z.enum([
  'theme',
  'language',
  'transcription.lectureLanguage',
  'transcription.diarizationEnabled',
  'transcription.includeSystemAudio',
]);
export type PluginAppSettingKey = z.infer<typeof pluginAppSettingKeySchema>;

export const pluginAppSettingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type PluginAppSettingValue = z.infer<typeof pluginAppSettingValueSchema>;

export const pluginGetSettingParamsSchema = z.object({
  key: pluginAppSettingKeySchema,
});
export type PluginGetSettingParams = z.infer<
  typeof pluginGetSettingParamsSchema
>;

export const pluginSettingsSnapshotSchema = z.record(
  pluginAppSettingKeySchema,
  pluginAppSettingValueSchema,
);
export type PluginSettingsSnapshot = z.infer<
  typeof pluginSettingsSnapshotSchema
>;
