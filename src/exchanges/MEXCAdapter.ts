import { BaseAdapter } from './BaseAdapter';
import type { Balance, Position, OrderParams, OrderResult } from '../types';

/**
 * MEXC adapter — stub implementation.
 * Docs: https://mexcdevelop.github.io/apidocs/
 */
export class MEXCAdapter extends BaseAdapter {
  id = 'mexc' as const;
  name = 'MEXC';

  async getBalance(): Promise<Balance[]> {
    // TODO: GET /api/v3/account
    return [];
  }

  async getPositions(): Promise<Position[]> {
    // TODO: GET /api/v1/private/position/list/open-positions
    return [];
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    console.log('[MEXC] placeOrder', order);
    return { success: true, orderId: `MX-${Date.now()}` };
  }

  async closePosition(positionId: string): Promise<boolean> {
    console.log('[MEXC] closePosition', positionId);
    return true;
  }

  async getPrice(symbol: string): Promise<number> {
    const prices: Record<string, number> = { 'SOL/USDT': 142.8 };
    return prices[symbol] ?? 0;
  }
}
