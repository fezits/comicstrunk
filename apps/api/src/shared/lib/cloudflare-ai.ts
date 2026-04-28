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

REGRA CRITICA — preserve o idioma original da capa:
- Se a capa esta em portugues (ex: "Tartarugas Ninja: O Ultimo Ronin"), mantenha o
  titulo EM PORTUGUES exatamente como aparece. NAO traduza pra ingles, NAO use o
  nome internacional ("TMNT: The Last Ronin"). O usuario tem a edicao BR e
  precisamos achar a edicao BR no catalogo.
- Mesmo principio para mangas (ex: "Naruto Gold" pt-BR fica em portugues, nao
  vira "Naruto Shippuden" original japones).
- "title" eh o texto principal/maior visivel na capa, EXATAMENTE como aparece.
- "series" pode incluir o nome da franquia (Tartarugas Ninja, Batman, Naruto,
  Dragon Ball) tbm no idioma da capa.
- Acentos sao OBRIGATORIOS quando aparecem na capa: "O Ultimo" -> "O Último",
  "Edicao" -> "Edição", "ANOS PERDIDOS" pode ficar como "Anos Perdidos".

Regras gerais:
- Retorne APENAS um objeto JSON valido, sem markdown, sem explicacoes.
- Se nao tiver certeza de algum campo, use null para esse campo (exceto "ocr_text", que sempre tem string).
- "confidence" reflete o quanto voce esta certo do "title".
- "ocr_text" deve listar TODO texto visivel na capa, INCLUINDO numeros, "Vol", "Tomo", "#", subtitulos, creditos. Separe por quebras de linha. Nao filtre nada. Sempre no idioma original.
- "issue_number" eh o numero da edicao/volume/tomo. Procure ATIVAMENTE por padroes como "#5", "Vol. 2", "Tomo 3", "Numero 7", "N. 12", "Edicao 4". Se ver apenas um numero isolado destacado na capa, provavelmente eh ele. Se nao houver numero algum visivel, use null.
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
    throw new InternalError('Cloudflare Workers AI não configurado (env vars faltando).');
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
    throw new InternalError('Workers AI retornou resposta vazia.');
  }

  // Cloudflare Workers AI as vezes parseia o JSON automaticamente (retorna
  // objeto), outras vezes retorna a string crua do modelo. Tratamos ambos.
  let parsed: Record<string, unknown> | null;
  let rawForLog: string;
  if (typeof responseRaw === 'string') {
    parsed = extractJson(responseRaw);
    rawForLog = responseRaw;
    if (!parsed) {
      // Loga a resposta inteira (truncada a 4000 chars) pra diagnostico, e
      // mostra so o inicio na mensagem de erro do usuario.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger } = require('./logger');
      logger.warn('cloudflare-ai: invalid JSON response', {
        raw: responseRaw.slice(0, 4000),
        length: responseRaw.length,
      });
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
 * markdown, texto extra antes/depois, ou problemas comuns de LLM (aspas
 * nao escapadas em strings longas, quebras de linha cruas, virgulas finais).
 */
function extractJson(text: string): Record<string, unknown> | null {
  // 1) parse direto
  try {
    return JSON.parse(text);
  } catch {
    /* segue */
  }

  // 2) strip de fence markdown ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    const cleaned = fenced[1].trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      /* segue tentando consertar */
    }
    const repaired = repairJson(cleaned);
    if (repaired) return repaired;
  }

  // 3) extracao por contagem balanceada de chaves respeitando strings.
  // Resolve casos onde o modelo concatena texto explicativo apos o JSON
  // ("here's the JSON: {...} Hope this helps.").
  const balanced = extractBalancedObject(text);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      const repaired = repairJson(balanced);
      if (repaired) return repaired;
    }
  }

  // 4) ultimo recurso: do primeiro `{` ao ultimo `}` da string inteira
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      const repaired = repairJson(candidate);
      if (repaired) return repaired;
    }
  }

  return null;
}

/**
 * Encontra o primeiro objeto JSON balanceado (chave-a-chave) no texto,
 * respeitando strings (aspas) e escapes — assim, `{ "x": "}" }` nao para
 * cedo no `}` interno.
 */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Tenta consertar JSON com problemas tipicos gerados por LLMs:
 *  - virgulas finais antes de `}` ou `]`
 *  - quebras de linha cruas dentro de strings (devem ser \n)
 *  - aspas nao escapadas dentro de strings
 *
 * Heuristica conservadora: so retorna se o resultado parser. Se quebrar
 * mais ainda, retorna null.
 */
function repairJson(s: string): Record<string, unknown> | null {
  let candidate = s;

  // Remove virgulas finais: `, }` -> ` }`, `, ]` -> ` ]`
  candidate = candidate.replace(/,(\s*[}\]])/g, '$1');

  // Escapa quebras de linha cruas dentro de strings.
  // Caminha pelo texto e troca \n e \r por \\n e \\r quando dentro de string.
  candidate = escapeRawNewlinesInStrings(candidate);

  try {
    return JSON.parse(candidate);
  } catch {
    /* segue tentando: aspas nao escapadas */
  }

  // Tentativa final: pra cada string, escapar aspas que aparecem antes do
  // proximo delimitador (`",` ou `"}` ou `"]`). Isso quebra muitos casos
  // mas resolve o caso comum de citacao em ocr_text.
  const escaped = escapeStrayQuotesInStrings(candidate);
  if (escaped !== candidate) {
    try {
      return JSON.parse(escaped);
    } catch {
      /* desistiu */
    }
  }

  return null;
}

function escapeRawNewlinesInStrings(s: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        out += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') {
        out += '\\r';
        continue;
      }
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      out += ch;
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out;
}

/**
 * Escapa aspas dentro de string que nao parecem ser fim de string —
 * detectamos fim valido por padrao seguinte: `",`, `"}`, `"]`, ou final.
 */
function escapeStrayQuotesInStrings(s: string): string {
  let out = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    // dentro de string
    if (ch === '\\') {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      // olha proximo char nao-whitespace; se for delimitador valido,
      // termina a string. Senao, escapa.
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      const next = s[j];
      // Delimitadores validos depois do fim de uma string JSON:
      //  - `:` apos chave de objeto
      //  - `,` entre campos/elementos
      //  - `}` fim de objeto
      //  - `]` fim de array
      //  - undefined (fim do input)
      if (
        next === ',' ||
        next === ':' ||
        next === '}' ||
        next === ']' ||
        next === undefined
      ) {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
    } else {
      out += ch;
    }
  }
  return out;
}
