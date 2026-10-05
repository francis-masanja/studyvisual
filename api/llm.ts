export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string | null;
  mode: 'openai' | 'ollama';
}

/**
 * Reads the AI configuration from the environment.
 * Supported keys (any combination works):
 *   OLLAMA_BASE_URL | OLLAMA_URL | OLLAMA_API_BASE
 *   OLLAMA_MODEL    | OLLAMA_MODEL_NAME
 *   OLLAMA_API_KEY  | OLLAMA_KEY   (presence switches to OpenAI-compatible mode)
 */
export const readLlmConfig = (): LlmConfig | null => {
  const baseUrl = (
    process.env.OLLAMA_BASE_URL ||
    process.env.OLLAMA_URL ||
    process.env.OLLAMA_API_BASE ||
    process.env.LLM_BASE_URL ||
    ''
  ).trim();

  if (!baseUrl) return null;

  const model = (
    process.env.OLLAMA_MODEL ||
    process.env.OLLAMA_MODEL_NAME ||
    process.env.LLM_MODEL ||
    'llama3.2'
  ).trim();

  const apiKey = (
    process.env.OLLAMA_API_KEY ||
    process.env.OLLAMA_KEY ||
    process.env.LLM_API_KEY ||
    ''
  ).trim() || null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    model,
    apiKey,
    mode: apiKey ? 'openai' : 'ollama'
  };
};

export const isLlmConfigured = (): boolean => readLlmConfig() !== null;

const notConfiguredError = (): Error =>
  new Error('AI is not configured. Set OLLAMA_BASE_URL and OLLAMA_MODEL (plus OLLAMA_API_KEY for hosted endpoints) in .env.');

const openAiUrl = (baseUrl: string): string => {
  if (baseUrl.endsWith('/chat/completions')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
};

const ollamaUrl = (baseUrl: string): string => {
  if (baseUrl.endsWith('/api/chat')) return baseUrl;
  if (/\/v\d+$/.test(baseUrl)) return baseUrl.replace(/\/v\d+$/, '/api/chat');
  return `${baseUrl}/api/chat`;
};

const extractJson = (text: string): string => {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const startObj = unfenced.indexOf('{');
  const startArr = unfenced.indexOf('[');
  const start = startObj === -1 ? startArr : startArr === -1 ? startObj : Math.min(startObj, startArr);
  if (start === -1) return unfenced;
  const endObj = unfenced.lastIndexOf('}');
  const endArr = unfenced.lastIndexOf(']');
  const end = Math.max(endObj, endArr);
  return end > start ? unfenced.slice(start, end + 1) : unfenced;
};

export const parseJsonFromLlm = <T>(text: string): T => {
  const cleaned = extractJson(text);
  const parsed = JSON.parse(cleaned) as T;
  return parsed;
};

export interface LlmOptions {
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
}

/** Send a chat completion to the configured provider and return the text. */
export const llmChat = async (messages: ChatMessage[], options: LlmOptions = {}): Promise<string> => {
  const config = readLlmConfig();
  if (!config) throw notConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60000);

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    let url: string;
    let body: Record<string, unknown>;

    if (config.mode === 'openai') {
      url = openAiUrl(config.baseUrl);
      headers.authorization = `Bearer ${config.apiKey}`;
      body = {
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        ...(options.json ? { response_format: { type: 'json_object' } } : {})
      };
    } else {
      url = ollamaUrl(config.baseUrl);
      body = {
        model: config.model,
        messages,
        stream: false,
        options: { temperature: options.temperature ?? 0.7 },
        ...(options.json ? { format: 'json' } : {})
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      message?: { content?: string };
      error?: string;
    };

    if (config.mode === 'openai') {
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('AI provider returned an empty response');
      }
      return content;
    }

    if (typeof data.message?.content === 'string' && data.message.content.trim() !== '') {
      return data.message.content;
    }
    if (data.error) throw new Error(data.error);
    throw new Error('AI provider returned an empty response');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI request timed out', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
