import { BaseAdapter } from './BaseAdapter';
import type { Balance, Position, OrderParams, OrderResult } from '../types';

/**
 * Kraken adapter — stub implementation.
 * Docs: https://docs.kraken.com/api/
 */
export class KrakenAdapter extends BaseAdapter {
  id = 'kraken' as const;
  name = 'Kraken';

  async getBalance(): Promise<Balance[]> {
    // TODO: POST /0/private/Balance
    return [];
  }

  async getPositions(): Promise<Position[]> {
    // TODO: POST /0/private/OpenPositions
    return [];
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    console.log('[Kraken] placeOrder', order);
    return { success: true, orderId: `KR-${Date.now()}` };
  }

  async closePosition(positionId: string): Promise<boolean> {
    console.log('[Kraken] closePosition', positionId);
    return true;
  }

  async getPrice(symbol: string): Promise<number> {
    const prices: Record<string, number> = { 'XRP/USDT': 0.625 };
    return prices[symbol] ?? 0;
  }
}
