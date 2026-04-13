import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TradingViewSignal {
  /** e.g. "BTC/USDT" */
  ticker:     string;
  /** "buy" | "sell" | "close_long" | "close_short" */
  action:     'buy' | 'sell' | 'close_long' | 'close_short';
  /** e.g. "1h", "4h", "1d" */
  timeframe?: string;
  /** Strategy name or indicator label */
  strategy?:  string;
  /** Signal price at the time of the alert */
  price?:     number;
  /** Optional stop-loss price */
  stopLoss?:  number;
  /** Optional take-profit price */
  takeProfit?: number;
  /** Any extra fields TradingView sends */
  [key: string]: unknown;
}

interface WebhookResponse {
  ok:        boolean;
  received:  string;
  ticker?:   string;
  action?:   string;
  message?:  string;
  error?:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {

  // CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-TradingView-Signature');
    res.status(204).end();
    return;
  }

  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, received: new Date().toISOString(), error: 'Method not allowed' } as WebhookResponse);
    return;
  }

  // ── Read raw body (needed for signature verification) ──────────────────────
  const rawBody = await readRawBody(req);

  // ── Optional HMAC-SHA256 signature check ───────────────────────────────────
  // Set WEBHOOK_SECRET in Vercel environment variables.
  // In TradingView alert message, append: X-TradingView-Signature header.
  const secret    = process.env.WEBHOOK_SECRET;
  const signature = req.headers['x-tradingview-signature'] as string | undefined;

  if (secret && signature) {
    if (!verifySignature(rawBody, signature, secret)) {
      res.status(401).json({
        ok: false,
        received: new Date().toISOString(),
        error: 'Invalid signature',
      } as WebhookResponse);
      return;
    }
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let signal: TradingViewSignal;
  try {
    signal = JSON.parse(rawBody) as TradingViewSignal;
  } catch {
    res.status(400).json({
      ok: false,
      received: new Date().toISOString(),
      error: 'Invalid JSON body',
    } as WebhookResponse);
    return;
  }

  // ── Validate required fields ────────────────────────────────────────────────
  if (!signal.ticker || !signal.action) {
    res.status(422).json({
      ok: false,
      received: new Date().toISOString(),
      error: 'Missing required fields: ticker, action',
    } as WebhookResponse);
    return;
  }

  const validActions = ['buy', 'sell', 'close_long', 'close_short'];
  if (!validActions.includes(signal.action)) {
    res.status(422).json({
      ok: false,
      received: new Date().toISOString(),
      error: `Unknown action "${signal.action}". Allowed: ${validActions.join(', ')}`,
    } as WebhookResponse);
    return;
  }

  // ── Process signal ─────────────────────────────────────────────────────────
  // Here you would forward the signal to your exchange adapter, database, or
  // internal queue. For now we log it and return a success response.
  const timestamp = new Date().toISOString();

  console.log('[webhook]', timestamp, JSON.stringify({
    ticker:     signal.ticker,
    action:     signal.action,
    timeframe:  signal.timeframe,
    strategy:   signal.strategy,
    price:      signal.price,
    stopLoss:   signal.stopLoss,
    takeProfit: signal.takeProfit,
  }));

  // TODO: forward to exchange adapter
  // e.g. await placeOrder(signal);

  res.status(200).json({
    ok:       true,
    received: timestamp,
    ticker:   signal.ticker,
    action:   signal.action,
    message:  `Signal accepted: ${signal.action.toUpperCase()} ${signal.ticker}`,
  } as WebhookResponse);
}
