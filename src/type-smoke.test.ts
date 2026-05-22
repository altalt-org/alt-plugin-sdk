import { describe, expectTypeOf, it } from 'vitest';
import type {
  AltPluginApi,
  PluginAiModelInfo,
  PluginActionResultMap,
  PluginEventData,
  PluginFolderNode,
  PluginManifest,
  PluginNoteContent,
  PluginNoteSummary,
} from './index';
import { createAltProvider } from './ai';
import { defineManifest } from './index';

describe('alt-plugin-sdk type smoke', () => {
  it('types plugin manifests, events, and actions for consumers', () => {
    const manifest = defineManifest({
      id: 'typed.consumer',
      name: 'Typed Consumer',
      version: '1.0.0',
      entry: 'index.html',
      permissions: ['storage', 'actions:notes', 'ai:chat'],
    });

    expectTypeOf(manifest).toMatchTypeOf<PluginManifest>();
    expectTypeOf<PluginEventData<'activeNoteChanged'>>().toEqualTypeOf<{
      id: number;
      title: string;
      status: 'draft' | 'in_progress' | 'completed';
      createdAt: string;
      updatedAt: string;
    } | null>();
    expectTypeOf<PluginActionResultMap['notes.select']>().toEqualTypeOf<{
      ok: true;
    }>();
    expectTypeOf<PluginAiModelInfo['id']>().toEqualTypeOf<
      'gpt-5.4' | 'auto' | 'local'
    >();
    expectTypeOf<Window['alt']>().toEqualTypeOf<AltPluginApi>();
    expectTypeOf(createAltProvider()).toHaveProperty('languageModel');
    expectTypeOf<PluginFolderNode['children']>().toEqualTypeOf<
      PluginFolderNode[]
    >();
    expectTypeOf<PluginNoteSummary['folderId']>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<PluginNoteContent>().toMatchTypeOf<{
      id: number;
      title: string;
      transcript: string;
      memo: string;
      summary: string;
    }>();
  });
});
