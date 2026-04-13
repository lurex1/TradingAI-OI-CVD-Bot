import type { AggressionLevel, AggressionConfig } from '../types';

export const AGGRESSION_CONFIGS: Record<Exclude<AggressionLevel, 'AUTO'>, AggressionConfig> = {
  LOW:    { sl: 2,  tp: 4,  leverage: 3  },
  MEDIUM: { sl: 3,  tp: 6,  leverage: 5  },
  HIGH:   { sl: 5,  tp: 10, leverage: 10 },
};

export function computeEffectiveAggression(
  level: AggressionLevel,
  priceChange24h = 0,
  volumeSpike = 1
): Exclude<AggressionLevel, 'AUTO'> {
  if (level !== 'AUTO') return level;
  const volatility = Math.abs(priceChange24h);
  if (volatility > 8 || volumeSpike > 3) return 'LOW';
  if (volatility > 4 || volumeSpike > 1.5) return 'MEDIUM';
  return 'HIGH';
}

export function calculateSLTP(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  config: AggressionConfig
): { sl: number; tp: number } {
  const slMult = side === 'LONG' ? 1 - config.sl / 100 : 1 + config.sl / 100;
  const tpMult = side === 'LONG' ? 1 + config.tp / 100 : 1 - config.tp / 100;
  return { sl: entryPrice * slMult, tp: entryPrice * tpMult };
}
