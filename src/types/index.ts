export type ExchangeId = 'mexc' | 'binance' | 'bybit' | 'okx' | 'kraken';
export type DexId = 'metamask' | 'walletconnect';
export type AnyExchangeId = ExchangeId | DexId;
export type AggressionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'AUTO';
export type BotStatus = 'IDLE' | 'VERIFYING' | 'RUNNING' | 'STOPPED';
export type PositionSide = 'LONG' | 'SHORT';
export type CloseReason = 'SL' | 'TP' | 'CLAUDE' | 'MANUAL';

export interface AggressionConfig {
  sl: number;
  tp: number;
  leverage: number;
}

export interface Exchange {
  id: AnyExchangeId;
  name: string;
  type: 'CEX' | 'DEX';
  logo: string;
  connected: boolean;
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
  walletAddress?: string;
}

export interface ActivePosition {
  id: string;
  side: PositionSide;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  sl: number;
  tp: number;
  slPercent: number;
  tpPercent: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  openedAt: string;
  claudeReason: string;
}

export interface ClosedTrade {
  id: string;
  pair: string;
  exchange: AnyExchangeId;
  side: PositionSide;
  entryPrice: number;
  closePrice: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
  closedAt: string;
  closeReason: CloseReason;
  aggressionLevel: AggressionLevel;
  claudeAnalysis: string;
}

export interface BotConfig {
  pair: string;
  exchange: AnyExchangeId;
  duration: number; // minutes, 0 = indefinite
  aggression: AggressionLevel;
}

export interface BotState {
  status: BotStatus;
  config: BotConfig | null;
  startedAt: string | null;
  endsAt: string | null;
  currentPosition: ActivePosition | null;
  effectiveAggression: Exclude<AggressionLevel, 'AUTO'>;
  lastClaudeCheck: string | null;
}

export interface WebhookSignal {
  pair: string;
  action: 'LONG' | 'SHORT' | 'CLOSE';
  price: number;
  oi: number;
  cvd: number;
  volume: number;
  timestamp: string;
}

export interface ClaudeDecision {
  action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'HOLD';
  reasoning: string;
  confidence: number;
  suggestedAggression?: Exclude<AggressionLevel, 'AUTO'>;
  timestamp: string;
}

// ── Exchange adapter types (kept for adapter implementations) ──────────────
export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

/** Legacy position shape used by exchange adapter stubs */
export interface Position {
  id: string;
  exchange: ExchangeId;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  liquidationPrice: number;
  openedAt: string;
  closedAt?: string;
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
}

export interface ExchangeAdapter {
  id: ExchangeId;
  name: string;
  connect(apiKey: string, apiSecret: string): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  getBalance(): Promise<Balance[]>;
  getPositions(): Promise<Position[]>;
  placeOrder(order: OrderParams): Promise<OrderResult>;
  closePosition(positionId: string): Promise<boolean>;
  getPrice(symbol: string): Promise<number>;
}
