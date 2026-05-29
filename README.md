# `alt-plugin-sdk`

[![npm](https://img.shields.io/npm/v/alt-plugin-sdk.svg)](https://www.npmjs.com/package/alt-plugin-sdk)

Type-safe browser SDK and runtime contracts for Alt plugins.

Plugins run inside an isolated `WebContentsView` and talk to the host through a single `window.alt` object exposed by Alt's preload bridge. This package ships:

- the `alt` runtime client that proxies into `window.alt`
- the Zod schemas + TypeScript types every Alt plugin call uses
- `defineManifest(...)` for authoring `manifest.json` in TypeScript
- `createAltFetch()` / `createAltProvider()` AI helpers for AI-SDK consumers

## Install

Published on npm: <https://www.npmjs.com/package/alt-plugin-sdk>

```bash
pnpm add alt-plugin-sdk
# or
npm install alt-plugin-sdk
# or
yarn add alt-plugin-sdk
```

```ts
import { alt, defineManifest } from 'alt-plugin-sdk';

export const manifest = defineManifest({
  id: 'my.plugin',
  name: 'My Plugin',
  version: '1.0.0',
  entry: 'index.html',
  permissions: ['storage', 'notes:read'],
});

const folders = await alt.notes.listFolders();
```

## Manifest

`manifest.json` lives at the root of the plugin bundle. Fields:

| Field         | Type       | Notes                                                                              |
| ------------- | ---------- | ---------------------------------------------------------------------------------- |
| `id`          | `string`   | Lowercase, dots/dashes/underscores allowed                                         |
| `name`        | `string`   | Display name                                                                       |
| `version`     | `string`   | Semver string                                                                      |
| `entry`       | `string`   | HTML file path inside the bundle                                                   |
| `permissions` | `string[]` | See below — all requested permissions are granted on install                       |
| `sdkVersion`  | `string`   | Optional. Defaults to `"1"`. The host refuses plugins whose major exceeds its own. |
| `description` | `string`   | Optional, ≤ 500 chars                                                              |
| `author`      | `string`   | Optional                                                                           |
| `icon`        | `string`   | Optional, data URI or relative path                                                |
| `locales`     | `object`   | Optional. Per-locale overrides for `name`/`description` — see below.               |

### Localized name & description

`name` and `description` are the default (fallback) values. To show a localized
name/description in the marketplace and the installed-plugins list, add a
`locales` map keyed by locale code. Alt resolves the host's UI language (`en`,
`ko`, `de`), falling back per field to the top-level value:

```jsonc
{
  "name": "Quiz Generator",
  "description": "Generate quizzes from your notes.",
  "locales": {
    "ko": { "name": "퀴즈 생성기", "description": "노트로 퀴즈를 만드세요." },
    "de": { "name": "Quiz-Generator" }, // description falls back to the default
  },
}
```

`resolveLocalizedManifest(manifest, locale)` (exported from the SDK) performs
this resolution if you need it at runtime.

## Permissions

A plugin is granted exactly what its manifest declares. Methods that need a permission throw at the IPC boundary if it's missing.

| Permission          | Surface it unlocks                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `storage`           | `alt.storage.*`                                                                                                          |
| `appState:read`     | `alt.state.getActiveNoteSummary()`                                                                                       |
| `events:subscribe`  | `alt.events.subscribe(...)`                                                                                              |
| `notes:read`        | `alt.notes.list*`, `getContent`, `getMemo`, `listComponents`, `getComponent`                                             |
| `notes:write`       | `alt.notes.create/update/delete/setMemo/setSummary/appendTranscriptLine/upsertComponent/deleteComponent`                 |
| `notes:select`      | `alt.notes.select(...)` — focuses a note in Alt's main window                                                            |
| `folders:write`     | `alt.folders.create/rename/move/delete`                                                                                  |
| `ai:chat`           | `alt.ai.models.list / stream / chat.stream / complete / summarize`                                                       |
| `recording:control` | `alt.recording.start/stop/getStatus`                                                                                     |
| `transcription:run` | `alt.transcription.transcribeFile / transcribeNote`                                                                      |
| `files:read`        | `alt.files.list / read`                                                                                                  |
| `files:write`       | `alt.files.attach / delete`                                                                                              |
| `settings:read`     | `alt.settings.get / list`; `alt.locale.get` (with `events:subscribe` for `alt.locale.onChange`)                          |
| `actions:notes`     | **Legacy.** Old plugins that declare this get `notes:write` + `notes:select` automatically — no manifest changes needed. |

## API surface

Every method below is a method on `alt.<namespace>` and returns a `Promise` (or, for streaming, a handle).

### `alt.storage`

JSON key-value scoped to your plugin.

- `get(key)` / `set(key, value)` / `delete(key)` / `list()`

### `alt.state`

- `getActiveNoteSummary()` — the note the user is currently looking at, or `null`.

### `alt.events`

`subscribe<TEvent>(event, callback) → unsubscribe`. Events the host emits:

- `activeNoteChanged` — payload is the new active note summary or `null`
- `recordingStatusChanged` — `{ status, noteId, durationMs }`
- `transcriptUpdated` — `{ noteId }`
- `noteCreated` / `noteUpdated` — note summary
- `noteDeleted` — `{ noteId }`
- `folderCreated` / `folderUpdated` — folder node
- `folderDeleted` — `{ folderId }`
- `componentUpdated` — component summary
- `settingChanged` — `{ key, value }` for a curated app setting
- `recordingLevel` — reserved; not emitted yet

### `alt.notes`

Read:

- `listFolders()` → recursive folder tree
- `list({ folderId?, query?, limit? })` → note summaries (max 200)
- `getContent(noteId)` → `{ transcript, memo, summary, title }`
- `getMemo({ noteId })` → `{ markdown }`
- `listComponents({ noteId })`
- `getComponent({ componentId })`

Write:

- `create({ title, folderId? })`
- `select({ noteId })`
- `update({ noteId, title?, status?, folderId? })`
- `delete({ noteId })`
- `setMemo({ noteId, markdown })` / `setSummary({ noteId, markdown })`
- `appendTranscriptLine({ noteId, text, startMs, endMs?, speaker? })`
- `upsertComponent({ noteId, componentType, title, contentText, componentId?, displayOrder? })` — text-based components only
- `deleteComponent({ componentId })`

### `alt.folders`

- `create({ name, parentId? })` / `rename({ folderId, name })` / `move({ folderId, parentId })` / `delete({ folderId })`

### `alt.ai`

- `models.list()` → which models are available to this plugin
- `chat.stream(request, handlers)` → OpenAI-compatible streaming via `MessageChannel`. Plugins typically use `createAltFetch()` / `createAltProvider()` from this package instead.
- `complete(request)` → non-streaming convenience. Buffers the stream and returns `{ text, finishReason, toolCalls? }`.
- `summarize({ noteId, style?, outputLanguage?, model? })` → runs Alt's built-in summarize prompt against the note's transcript + memo and returns `{ noteId, text }`.
- `stream(...)` — **`@deprecated`**. Use `alt.ai.chat.stream` instead.

### `alt.recording`

- `start({ noteId, lectureLanguage?, targetTranslationLanguage?, includeSystemAudio?, selectedDeviceId? })` → `{ ok, sessionId }`
- `stop()` / `getStatus()` → typed `PluginRecordingStatus`

Pause/resume are deliberately not exposed — Alt itself doesn't support them.

### `alt.transcription`

Both methods stream segments through `PluginTranscriptionStreamHandlers` and return a handle with `cancel()`.

- `transcribeFile({ requestId, filePath, language?, diarization? }, handlers)` — arbitrary audio path on disk
- `transcribeNote({ requestId, noteId, language?, diarization? }, handlers)` — resolves the note's recording component to a path automatically

Handler shape: `onStart({ durationMs })`, `onSegment(segment)`, `onProgress({ fraction })`, `onEnd({ segments })`, `onError({ code, message })`.

### `alt.files`

- `attach({ noteId, fileName, data, mimeType?, componentType, title?, displayOrder? })` — writes the bytes under Alt's plugin storage directory and creates a `slides` or `recording` component
- `list({ noteId })` → `PluginAttachedFile[]`
- `read({ fileId })` → `{ fileName, mimeType, sizeBytes, data: ArrayBuffer }`
- `delete({ componentId })`

### `alt.settings`

Read-only, curated allowlist. Plugins that need their own settings should use `alt.storage`.

- `get(key)` — one of `theme`, `language`, `transcription.lectureLanguage`, `transcription.diarizationEnabled`, `transcription.includeSystemAudio`
- `list()` → snapshot of every key above

### `alt.locale`

Convenience wrapper over the `language` setting + the `settingChanged` event, for localizing your plugin's own UI. Needs `settings:read` and `events:subscribe`.

- `get()` → the host's current UI language (e.g. `'en'`, `'ko'`, `'de'`); defaults to `'en'` when unset
- `onChange(callback)` → fires with the new locale whenever the user switches the app language; returns an async unsubscribe

```ts
const locale = await alt.locale.get();
const stop = await alt.locale.onChange(next => render(next));
// later: await stop();
```

## AI helpers

```ts
import { createAltFetch, createAltProvider } from 'alt-plugin-sdk';
import { generateText } from 'ai';

const provider = createAltProvider();
const { text } = await generateText({
  model: provider.languageModel('auto'),
  prompt: 'hello',
});
```

`createAltFetch()` returns a `fetch`-compatible function that proxies into `alt.ai.chat.stream`, so any AI SDK that accepts a custom `fetch` (Vercel AI SDK, OpenAI SDK, etc.) works out of the box.

## SDK versioning

The SDK declares a major version (`PLUGIN_HOST_SDK_MAJOR`). Set `manifest.sdkVersion` to the major your plugin was built against; the host refuses plugins targeting a higher major than it supports. Defaults to `"1"`.
