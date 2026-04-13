import { BaseAdapter } from './BaseAdapter';
import type { Balance, Position, OrderParams, OrderResult } from '../types';

/**
 * Binance adapter — stub implementation.
 * In production replace stubs with real Binance REST/WebSocket calls.
 * Docs: https://binance-docs.github.io/apidocs/
 */
export class BinanceAdapter extends BaseAdapter {
  id = 'binance' as const;
  name = 'Binance';

  async getBalance(): Promise<Balance[]> {
    // TODO: GET /api/v3/account
    return [
      { asset: 'USDT', free: 9234.18, locked: 3613.14, total: 12847.32, usdValue: 12847.32 },
      { asset: 'BTC', free: 0.05, locked: 0, total: 0.05, usdValue: 3407.5 },
    ];
  }

  async getPositions(): Promise<Position[]> {
    // TODO: GET /fapi/v2/positionRisk
    return [];
  }

  async placeOrder(order: OrderParams): Promise<OrderResult> {
    // TODO: POST /fapi/v1/order
    console.log('[Binance] placeOrder', order);
    return { success: true, orderId: `BN-${Date.now()}` };
  }

  async closePosition(positionId: string): Promise<boolean> {
    // TODO: place reduce-only order
    console.log('[Binance] closePosition', positionId);
    return true;
  }

  async getPrice(symbol: string): Promise<number> {
    // TODO: GET /api/v3/ticker/price?symbol=BTCUSDT
    const prices: Record<string, number> = {
      'BTC/USDT': 68150,
      'ETH/USDT': 3198.5,
      'SOL/USDT': 142.8,
    };
    return prices[symbol] ?? 0;
  }
}
