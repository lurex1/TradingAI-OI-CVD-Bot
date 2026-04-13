import { BaseAdapter } from './BaseAdapter';
import type { Balance, Position, OrderParams, OrderResult } from '../types';

/**
 * OKX adapter — stub implementation.
 * Docs: https://www.okx.com/docs-v5/en/
 */
export class OKXAdapter extends BaseAdapter {
  id = 'okx' as const;
  name = 'OKX';

  async getBalance(): Promise<Balance[]> {
    // TODO: GET /api/v5/account/balance
    return [];
  }

  async getPositions(): Promise<Position[]> {
    // TODO: GET /api/v5/account/positions
    return [];
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    console.log('[OKX] placeOrder', order);
    return { success: true, orderId: `OX-${Date.now()}` };
  }

  async closePosition(positionId: string): Promise<boolean> {
    console.log('[OKX] closePosition', positionId);
    return true;
  }

  async getPrice(symbol: string): Promise<number> {
    const prices: Record<string, number> = { 'BNB/USDT': 412.5 };
    return prices[symbol] ?? 0;
  }
}
