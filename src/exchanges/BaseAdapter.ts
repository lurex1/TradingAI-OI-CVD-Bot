import type { ExchangeAdapter, ExchangeId, Balance, Position, OrderParams, OrderResult } from '../types';

export abstract class BaseAdapter implements ExchangeAdapter {
  abstract id: ExchangeId;
  abstract name: string;

  protected _connected = false;
  protected _apiKey = '';
  protected _apiSecret = '';

  async connect(apiKey: string, apiSecret: string): Promise<boolean> {
    this._apiKey = apiKey;
    this._apiSecret = apiSecret;
    // In production: validate API credentials with a test call
    this._connected = true;
    return true;
  }

  disconnect(): void {
    this._connected = false;
    this._apiKey = '';
    this._apiSecret = '';
  }

  isConnected(): boolean {
    return this._connected;
  }

  // Subclasses implement these
  abstract getBalance(): Promise<Balance[]>;
  abstract getPositions(): Promise<Position[]>;
  abstract placeOrder(order: OrderParams): Promise<OrderResult>;
  abstract closePosition(positionId: string): Promise<boolean>;
  abstract getPrice(symbol: string): Promise<number>;
}
