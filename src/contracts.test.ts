import { describe, expect, it } from 'vitest';
import { defineManifest } from './index';
import {
  expandLegacyPermissions,
  parsePluginSdkMajor,
  pluginAiModelIdSchema,
  pluginAiModelInfoSchema,
  pluginAiStreamRequestSchema,
  pluginEventSchema,
  pluginFolderNodeSchema,
  pluginGetNoteContentParamsSchema,
  pluginManifestSchema,
  pluginNoteComponentSummarySchema,
  pluginNoteContentSchema,
  pluginNoteSummarySchema,
  pluginNotesListParamsSchema,
  pluginPermissionSchema,
  pluginRecordingStatusSchema,
  pluginSdkInvokeRequestSchema,
  pluginSdkMethodSchema,
  pluginStorageValueSchema,
  PLUGIN_HOST_SDK_MAJOR,
  PLUGIN_NOTES_LIST_MAX_LIMIT,
} from './contracts';

describe('alt-plugin-sdk contracts', () => {
  it('accepts a valid static plugin manifest through defineManifest', () => {
    const manifest = defineManifest({
      id: 'notes.timeline',
      name: 'Notes Timeline',
      version: '1.0.0',
      entry: 'index.html',
      permissions: ['storage', 'appState:read'],
    });

    expect(manifest).toMatchObject({
      id: 'notes.timeline',
      permissions: ['storage', 'appState:read'],
    });
  });

  it('rejects unsafe ids and unknown permissions at runtime', () => {
    expect(() =>
      pluginManifestSchema.parse({
        id: '../escape',
        name: 'Bad Plugin',
        version: '1.0.0',
        entry: 'index.html',
        permissions: ['filesystem'],
      }),
    ).toThrow();
  });

  it('validates SDK method names and JSON storage values', () => {
    expect(() =>
      pluginSdkInvokeRequestSchema.parse({
        requestId: '1',
        method: 'shell:openExternal',
      }),
    ).toThrow();

    expect(() =>
      pluginStorageValueSchema.parse({ ok: ['yes', 1, null] }),
    ).not.toThrow();
  });

  it('validates the public AI model contract without host model ids', () => {
    expect(pluginAiModelIdSchema.options).toEqual(['gpt-5.4', 'auto', 'local']);

    expect(() =>
      pluginAiModelInfoSchema.parse({
        id: 'gpt-5.4',
        name: 'GPT 5.4',
        provider: 'cloud',
        supportsTools: true,
        availability: 'ready',
      }),
    ).not.toThrow();

    expect(() => pluginAiModelIdSchema.parse('gpt-5.4-mini')).toThrow();
  });

  it('validates AI stream requests separately from generic invoke calls', () => {
    expect(() =>
      pluginSdkInvokeRequestSchema.parse({
        requestId: '1',
        method: 'ai:models:list',
      }),
    ).not.toThrow();

    expect(() =>
      pluginAiStreamRequestSchema.parse({
        requestId: '1',
        endpoint: 'chat.completions',
        model: 'auto',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'auto', messages: [] }),
      }),
    ).not.toThrow();
  });

  it('exposes notes:read permission and the three notes SDK methods', () => {
    expect(pluginPermissionSchema.options).toContain('notes:read');
    expect(pluginSdkMethodSchema.options).toEqual(
      expect.arrayContaining([
        'notes:listFolders',
        'notes:list',
        'notes:getContent',
      ]),
    );
  });

  it('accepts a recursive folder tree and rejects negative ids', () => {
    expect(() =>
      pluginFolderNodeSchema.parse({
        id: 1,
        name: 'Root',
        parentId: null,
        children: [
          {
            id: 2,
            name: 'Child',
            parentId: 1,
            children: [],
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      pluginFolderNodeSchema.parse({
        id: 0,
        name: 'Bad',
        parentId: null,
        children: [],
      }),
    ).toThrow();
  });

  it('accepts a valid note summary and rejects an unknown status', () => {
    expect(() =>
      pluginNoteSummarySchema.parse({
        id: 7,
        title: 'Lecture 1',
        folderId: null,
        status: 'draft',
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      }),
    ).not.toThrow();

    expect(() =>
      pluginNoteSummarySchema.parse({
        id: 7,
        title: 'Lecture 1',
        folderId: null,
        status: 'archived',
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('caps notes list limit at PLUGIN_NOTES_LIST_MAX_LIMIT', () => {
    expect(() => pluginNotesListParamsSchema.parse({})).not.toThrow();
    expect(() =>
      pluginNotesListParamsSchema.parse({
        folderId: 3,
        query: 'wave equations',
        limit: PLUGIN_NOTES_LIST_MAX_LIMIT,
      }),
    ).not.toThrow();
    expect(() =>
      pluginNotesListParamsSchema.parse({
        limit: PLUGIN_NOTES_LIST_MAX_LIMIT + 1,
      }),
    ).toThrow();
  });

  it('exposes the new write/recording/files/settings permissions', () => {
    expect(pluginPermissionSchema.options).toEqual(
      expect.arrayContaining([
        'notes:write',
        'notes:select',
        'folders:write',
        'recording:control',
        'transcription:run',
        'files:read',
        'files:write',
        'settings:read',
        'settings:write',
      ]),
    );
    // Legacy permission stays in the enum so old manifests still install.
    expect(pluginPermissionSchema.options).toContain('actions:notes');
  });

  it('exposes the new typed event names', () => {
    expect(pluginEventSchema.options).toEqual(
      expect.arrayContaining([
        'recordingLevel',
        'noteCreated',
        'noteUpdated',
        'noteDeleted',
        'folderCreated',
        'folderUpdated',
        'folderDeleted',
        'componentUpdated',
        'settingChanged',
      ]),
    );
  });

  it('promotes notes:create and notes:select to first-class SDK methods', () => {
    expect(pluginSdkMethodSchema.options).toEqual(
      expect.arrayContaining([
        'notes:create',
        'notes:select',
        'actions:invoke',
      ]),
    );
  });

  it('types the recordingStatusChanged payload as a discriminated phase', () => {
    expect(() =>
      pluginRecordingStatusSchema.parse({
        status: 'recording',
        noteId: 42,
        durationMs: 1500,
      }),
    ).not.toThrow();
    expect(() =>
      pluginRecordingStatusSchema.parse({
        status: 'idle',
        noteId: null,
        durationMs: 0,
      }),
    ).not.toThrow();
    expect(() =>
      pluginRecordingStatusSchema.parse({
        status: 'streaming',
        noteId: null,
        durationMs: 0,
      }),
    ).toThrow();
    expect(() =>
      pluginRecordingStatusSchema.parse({
        status: 'recording',
        noteId: 1,
        durationMs: -1,
      }),
    ).toThrow();
  });

  it('validates note component summaries', () => {
    expect(() =>
      pluginNoteComponentSummarySchema.parse({
        id: 1,
        noteId: 7,
        componentType: 'memo',
        title: 'My memo',
        displayOrder: 0,
        hasFile: false,
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:01:00.000Z',
      }),
    ).not.toThrow();
    expect(() =>
      pluginNoteComponentSummarySchema.parse({
        id: 1,
        noteId: 7,
        componentType: 'attachment',
        title: 'x',
        displayOrder: 0,
        hasFile: false,
        createdAt: '',
        updatedAt: '',
      }),
    ).toThrow();
  });

  it('defaults manifest.sdkVersion and rejects malformed values', () => {
    const manifest = pluginManifestSchema.parse({
      id: 'plugin.foo',
      name: 'Foo',
      version: '1.0.0',
      entry: 'index.html',
    });
    expect(manifest.sdkVersion).toBe(String(PLUGIN_HOST_SDK_MAJOR));

    expect(() =>
      pluginManifestSchema.parse({
        id: 'plugin.foo',
        name: 'Foo',
        version: '1.0.0',
        entry: 'index.html',
        sdkVersion: 'next',
      }),
    ).toThrow();
  });

  it('parses semver-shaped sdkVersion majors and rejects garbage', () => {
    expect(parsePluginSdkMajor('1')).toBe(1);
    expect(parsePluginSdkMajor('2.3.4')).toBe(2);
    expect(Number.isNaN(parsePluginSdkMajor('abc'))).toBe(true);
  });

  it('expands the legacy actions:notes grant to the new write/select pair', () => {
    expect(expandLegacyPermissions(['actions:notes'])).toEqual(
      expect.arrayContaining(['actions:notes', 'notes:write', 'notes:select']),
    );
    // No legacy grant means no expansion.
    expect(expandLegacyPermissions(['storage'])).toEqual(['storage']);
  });

  it('validates note content payloads', () => {
    expect(() =>
      pluginNoteContentSchema.parse({
        id: 1,
        title: 'Lecture 1',
        transcript: 'hello',
        memo: '# memo',
        summary: '## summary',
      }),
    ).not.toThrow();

    expect(() =>
      pluginGetNoteContentParamsSchema.parse({ noteId: 42 }),
    ).not.toThrow();
    expect(() =>
      pluginGetNoteContentParamsSchema.parse({ noteId: -1 }),
    ).toThrow();
  });
});
