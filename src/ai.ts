import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  type PluginAiEndpoint,
  type PluginAiModelId,
  pluginAiModelIdSchema,
} from './contracts.js';
import { getAlt } from './client.js';

const ALT_AI_BASE_URL = 'https://alt-plugin.invalid/v1';

export interface AltAiFetchOptions {
  model?: PluginAiModelId;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }

  return String(input);
}

function getEndpoint(input: RequestInfo | URL): PluginAiEndpoint {
  const url = new URL(getRequestUrl(input));
  if (url.pathname.endsWith('/chat/completions')) {
    return 'chat.completions';
  }

  throw new Error(`Unsupported Alt AI endpoint: ${url.pathname}`);
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (
      key.toLowerCase() !== 'authorization' &&
      key.toLowerCase() !== 'x-machine-id'
    ) {
      record[key] = value;
    }
  });
  return record;
}

async function createRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Request> {
  if (input instanceof Request) {
    return new Request(input, init);
  }

  return new Request(input, init);
}

function getModelFromBody(
  body: string,
  fallback: PluginAiModelId,
): PluginAiModelId {
  const parsed = JSON.parse(body) as { model?: unknown };
  return pluginAiModelIdSchema.parse(parsed.model ?? fallback);
}

export function createAltFetch(options: AltAiFetchOptions = {}): typeof fetch {
  const defaultModel = options.model ?? 'auto';

  return async (input, init) => {
    const request = await createRequest(input, init);
    const body = await request.text();
    const endpoint = getEndpoint(input);
    const model = getModelFromBody(body, defaultModel);

    return new Promise<Response>((resolve, reject) => {
      let streamController: ReadableStreamDefaultController<Uint8Array> | null =
        null;
      let started = false;
      let activeHandle: { cancel(): void } | null = null;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
        cancel() {
          activeHandle?.cancel();
        },
      });

      getAlt()
        .ai.stream(
          {
            requestId: crypto.randomUUID(),
            endpoint,
            model,
            method: 'POST',
            headers: headersToRecord(request.headers),
            body,
          },
          {
            onStart: meta => {
              started = true;
              resolve(
                new Response(stream, {
                  status: meta.status,
                  headers: meta.headers,
                }),
              );
            },
            onChunk: chunk => {
              streamController?.enqueue(new Uint8Array(chunk));
            },
            onEnd: () => {
              streamController?.close();
            },
            onError: error => {
              const nextError = new Error(error.message);
              nextError.name = error.code;
              if (!started) {
                reject(nextError);
                return;
              }
              streamController?.error(nextError);
            },
          },
        )
        .then(handle => {
          activeHandle = handle;
        })
        .catch(reject);
    });
  };
}

export function createAltProvider(options: AltAiFetchOptions = {}) {
  return createOpenAICompatible({
    baseURL: ALT_AI_BASE_URL,
    fetch: createAltFetch(options),
    name: 'alt-plugin',
  });
}
