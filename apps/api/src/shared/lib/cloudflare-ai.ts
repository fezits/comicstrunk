/**
 * Cliente fino do Cloudflare Workers AI.
 *
 * Foco: invocar modelos de visao (Llama 3.2 Vision) com imagem em data URI
 * e parsear o JSON estruturado que o modelo retorna como string.
 *
 * Depende de duas env vars:
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_API_TOKEN  (com permissao Workers AI Read+Edit)
 *   - CLOUDFLARE_AI_MODEL   (default: @cf/meta/llama-3.2-11b-vision-instruct)
 *
 * IMPORTANTE: a primeira chamada de cada modelo Llama na conta exige aceitar
 * a licenca via {"prompt":"agree"}. A conta usada ja aceitou em 2026-04-27.
 */

import { InternalError } from '../utils/api-error';

const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const API_BASE = 'https://api.cloudflare.com/client/v4';

export interface RecognizedCover {
  title: string | null;
  issue_number: number | null;
  publisher: string | null;
  authors: string[];
  series: string | null;
  language: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  ocr_text: string;
  raw_response: string; // resposta crua do modelo (debug + log)
}

const SYSTEM_PROMPT = `Voce eh um especialista em quadrinhos brasileiros, americanos e japoneses.
Sua tarefa: identificar a capa de um gibi a partir de uma imagem.

Regras:
- Retorne APENAS um objeto JSON valido, sem markdown, sem explicacoes.
- Se nao tiver certeza de algum campo, use null para esse campo (exceto "ocr_text", que sempre tem string).
- "confidence" reflete o quanto voce esta certo do "title".
- "ocr_text" deve listar TODO texto que voce conseguir ler na capa, mesmo que parcial — separado por quebras de linha.
- Idiomas comuns: pt-BR, en, jp, es. Se incerto, use "outro".

Schema:
{
  "title": string ou null,
  "issue_number": number inteiro ou null,
  "publisher": string ou null,
  "authors": [string],
  "series": string ou null,
  "language": "pt-BR"|"en"|"jp"|"es"|"outro"|null,
  "confidence": "alta"|"media"|"baixa",
  "ocr_text": string
}`;

const USER_PROMPT = 'Identifique este gibi pela capa.';

interface WorkersAIResponse {
  result?: {
    // Cloudflare as vezes parseia o JSON automaticamente e retorna objeto;
    // outras vezes retorna a string crua do modelo. Tratamos ambos os casos.
    response?: string | Record<string, unknown>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
}

/**
 * Invoca o Llama Vision com a imagem em data URI e retorna metadados estruturados.
 * Lanca InternalError se a chamada falhar ou se o JSON nao puder ser parseado.
 */
export async function recognizeCoverImage(
  imageDataUri: string,
): Promise<RecognizedCover> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const model = process.env.CLOUDFLARE_AI_MODEL || DEFAULT_MODEL;

  if (!accountId || !apiToken) {
    throw new InternalError('Cloudflare Workers AI nao configurado (env vars faltando)');
  }

  const url = `${API_BASE}/accounts/${accountId}/ai/run/${model}`;
  const payload = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `${SYSTEM_PROMPT}\n\n${USER_PROMPT}` },
          { type: 'image_url', image_url: { url: imageDataUri } },
        ],
      },
    ],
    max_tokens: 400,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new InternalError(`Erro de rede ao chamar Workers AI: ${(err as Error).message}`);
  }

  const json = (await res.json().catch(() => ({}))) as WorkersAIResponse;

  if (!res.ok || !json.success) {
    const errMsg = json.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new InternalError(`Workers AI falhou: ${errMsg}`);
  }

  const responseRaw = json.result?.response;
  if (responseRaw === undefined || responseRaw === null || responseRaw === '') {
    throw new InternalError('Workers AI retornou response vazio');
  }

  // Cloudflare Workers AI as vezes parseia o JSON automaticamente (retorna
  // objeto), outras vezes retorna a string crua do modelo. Tratamos ambos.
  let parsed: Record<string, unknown> | null;
  let rawForLog: string;
  if (typeof responseRaw === 'string') {
    parsed = extractJson(responseRaw);
    rawForLog = responseRaw;
    if (!parsed) {
      throw new InternalError(`Workers AI retornou JSON invalido: ${responseRaw.slice(0, 200)}`);
    }
  } else {
    parsed = responseRaw as Record<string, unknown>;
    rawForLog = JSON.stringify(responseRaw);
  }

  return {
    title: typeof parsed.title === 'string' ? parsed.title : null,
    issue_number: typeof parsed.issue_number === 'number' ? Math.floor(parsed.issue_number) : null,
    publisher: typeof parsed.publisher === 'string' ? parsed.publisher : null,
    authors: Array.isArray(parsed.authors)
      ? parsed.authors.filter((a: unknown): a is string => typeof a === 'string').slice(0, 10)
      : [],
    series: typeof parsed.series === 'string' ? parsed.series : null,
    language: typeof parsed.language === 'string' ? parsed.language : null,
    confidence:
      parsed.confidence === 'alta' || parsed.confidence === 'media' || parsed.confidence === 'baixa'
        ? parsed.confidence
        : 'baixa',
    ocr_text: typeof parsed.ocr_text === 'string' ? parsed.ocr_text : '',
    raw_response: rawForLog,
  };
}

/**
 * Extrai o primeiro objeto JSON valido encontrado em um texto que pode ter
 * markdown ou texto extra antes/depois.
 */
function extractJson(text: string): Record<string, unknown> | null {
  // Tentativa 1: parse direto
  try {
    return JSON.parse(text);
  } catch {
    // continua
  }

  // Tentativa 2: strip de fence markdown ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continua
    }
  }

  // Tentativa 3: pegar do primeiro { ate o ultimo }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // falhou tudo
    }
  }

  return null;
}
