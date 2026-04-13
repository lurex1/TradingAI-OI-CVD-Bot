import { BinanceAdapter } from './BinanceAdapter';
import { BybitAdapter } from './BybitAdapter';
import { MEXCAdapter } from './MEXCAdapter';
import { OKXAdapter } from './OKXAdapter';
import { KrakenAdapter } from './KrakenAdapter';
import type { ExchangeAdapter, ExchangeId } from '../types';

export const ADAPTERS: Record<ExchangeId, ExchangeAdapter> = {
  binance: new BinanceAdapter(),
  bybit: new BybitAdapter(),
  mexc: new MEXCAdapter(),
  okx: new OKXAdapter(),
  kraken: new KrakenAdapter(),
};

export function getAdapter(id: ExchangeId): ExchangeAdapter {
  return ADAPTERS[id];
}

export { BinanceAdapter, BybitAdapter, MEXCAdapter, OKXAdapter, KrakenAdapter };
