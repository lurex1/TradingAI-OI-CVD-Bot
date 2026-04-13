import { BaseAdapter } from './BaseAdapter';
import type { Balance, Position, OrderParams, OrderResult } from '../types';

/**
 * Bybit adapter — stub implementation.
 * Docs: https://bybit-exchange.github.io/docs/v5/intro
 */
export class BybitAdapter extends BaseAdapter {
  id = 'bybit' as const;
  name = 'Bybit';

  async getBalance(): Promise<Balance[]> {
    // TODO: GET /v5/account/wallet-balance
    return [
      { asset: 'USDT', free: 5000, locked: 1000, total: 6000, usdValue: 6000 },
    ];
  }

  async getPositions(): Promise<Position[]> {
    // TODO: GET /v5/position/list
    return [];
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    // TODO: POST /v5/order/create
    console.log('[Bybit] placeOrder', order);
    return { success: true, orderId: `BY-${Date.now()}` };
  }

  async closePosition(positionId: string): Promise<boolean> {
    console.log('[Bybit] closePosition', positionId);
    return true;
  }

  async getPrice(symbol: string): Promise<number> {
    // TODO: GET /v5/market/tickers
    const prices: Record<string, number> = { 'ETH/USDT': 3198.5 };
    return prices[symbol] ?? 0;
  }
}
