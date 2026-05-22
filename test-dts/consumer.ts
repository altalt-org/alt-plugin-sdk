import { alt, defineManifest } from '../src';
import { createAltProvider } from '../src/ai';

export const manifest = defineManifest({
  id: 'consumer.demo',
  name: 'Consumer Demo',
  version: '1.0.0',
  entry: 'index.html',
  permissions: ['storage', 'appState:read', 'events:subscribe', 'ai:chat'],
});

async function run(): Promise<void> {
  const provider = createAltProvider();
  provider.languageModel('auto');
  await alt.storage.set('key', { value: 1 });
  const models = await alt.ai.models.list();
  models.find(model => model.id === 'gpt-5.4')?.name.toUpperCase();
  const state = await window.alt.state.getActiveNoteSummary();
  await alt.events.subscribe('activeNoteChanged', activeNote => {
    activeNote?.title.toUpperCase();
  });
  if (state) {
    await alt.storage.set('status', state.status);
  }
}

void run();
