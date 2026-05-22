import {
  pluginManifestSchema,
  type PluginManifest,
  type PluginManifestInput,
} from './contracts.js';

export * from './client.js';
export * from './contracts.js';
export * from './ai.js';

export function defineManifest<const TManifest extends PluginManifestInput>(
  manifest: TManifest,
): PluginManifest & TManifest {
  return pluginManifestSchema.parse(manifest) as PluginManifest & TManifest;
}
