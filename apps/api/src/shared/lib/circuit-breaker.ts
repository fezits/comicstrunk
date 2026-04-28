/**
 * Circuit breaker em memoria, simples, sem dependencias.
 *
 * Estados:
 *   - CLOSED:    chamadas passam normalmente. Conta falhas consecutivas.
 *   - OPEN:      chamadas sao curto-circuitadas (retornam fallback imediato)
 *                ate o timeout expirar. Evita pagar latencia em fonte morta.
 *   - HALF_OPEN: depois do timeout, deixa UMA chamada passar. Se passar,
 *                volta pra CLOSED e zera contador. Se falhar, volta pra OPEN.
 *
 * Uso:
 *   const result = await withCircuitBreaker('amazon', async () => fetch(...), {
 *     fallback: [],
 *     failureThreshold: 3,
 *     openMs: 5 * 60_000,
 *   });
 *
 * Estado eh por-processo (PM2 fork). Em prod com 1 worker isso eh suficiente.
 */

import { logger } from './logger';

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitState {
  state: State;
  failures: number;
  openedAt: number;
}

const circuits = new Map<string, CircuitState>();

interface BreakerOpts<T> {
  fallback: T;
  failureThreshold?: number; // falhas consecutivas para abrir (default 3)
  openMs?: number;           // tempo em OPEN antes de tentar HALF_OPEN (default 5min)
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts: BreakerOpts<T>,
): Promise<T> {
  const failureThreshold = opts.failureThreshold ?? 3;
  const openMs = opts.openMs ?? 5 * 60_000;

  let circuit = circuits.get(name);
  if (!circuit) {
    circuit = { state: 'CLOSED', failures: 0, openedAt: 0 };
    circuits.set(name, circuit);
  }

  if (circuit.state === 'OPEN') {
    if (Date.now() - circuit.openedAt < openMs) {
      // Ainda no janela aberta — curto-circuita.
      return opts.fallback;
    }
    // Timeout expirou — deixa uma sonda passar.
    circuit.state = 'HALF_OPEN';
    logger.info(`circuit-breaker: ${name} -> HALF_OPEN (probe)`);
  }

  try {
    const result = await fn();
    if (circuit.state === 'HALF_OPEN') {
      logger.info(`circuit-breaker: ${name} -> CLOSED (probe ok)`);
    }
    circuit.state = 'CLOSED';
    circuit.failures = 0;
    return result;
  } catch (err) {
    circuit.failures++;
    if (circuit.state === 'HALF_OPEN' || circuit.failures >= failureThreshold) {
      circuit.state = 'OPEN';
      circuit.openedAt = Date.now();
      logger.warn(`circuit-breaker: ${name} -> OPEN`, {
        failures: circuit.failures,
        reason: (err as Error)?.message ?? 'unknown',
        cooldownMs: openMs,
      });
    }
    return opts.fallback;
  }
}

/**
 * Para introspeccao em rotas de admin/health (futuro).
 */
export function getCircuitStatus(): Record<string, CircuitState> {
  return Object.fromEntries(circuits.entries());
}
