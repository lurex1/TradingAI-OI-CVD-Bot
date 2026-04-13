// ── Market data service — Binance Futures primary, MEXC fallback ──────────────
const BN  = 'https://fapi.binance.com';
const MX  = 'https://api.mexc.com';
const MXC = 'https://contract.mexc.com';  // MEXC Futures

// ── Exported types ────────────────────────────────────────────────────────────
export type DataSource = 'binance' | 'mexc' | 'mock';

export interface MarketSnapshot {
  pair:            string;
  symbol:          string;    // e.g. "SOLUSDT"
  price:           number;
  priceChange24h:  number;    // %
  priceChange5m:   number;    // %
  volume24h:       number;    // USD
  // OI
  oiCurrent:       number;    // USD (or 0 if unavailable)
  oiFirst:         number;
  oiChangePct:     number;
  oiTrend:         'rising' | 'falling' | 'sideways';
  oiStrength:      'strong' | 'moderate' | 'weak';
  oiHistory:       number[];
  oiAvailable:     boolean;   // false when data source has no OI
  // CVD
  cvdTotal:        number;    // USD signed
  cvdLast:         number;    // USD signed last candle
  cvdHistory:      number[];
  // Meta
  dataSource:      DataSource;
  fetchedAt:       string;
  isMock?:         boolean;
}

// ── Internal API shapes ───────────────────────────────────────────────────────
interface OIRecord { sumOpenInterestValue: string }
// Kline indices: 0=openTime 1=O 2=H 3=L 4=C 5=baseVol 6=closeTime
//  7=quoteVol 8=trades 9=takerBuyBase 10=takerBuyQuote 11=ignore
type RawKline = [number, string, string, string, string, string,
                 number, string, number, string, string, string];
interface Ticker24h { lastPrice: string; priceChangePercent: string; quoteVolume: string }
interface MexcContractTicker { holdVol: string; lastPrice: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
export function pairToSymbol(pair: string): string {
  return pair.replace('/', '').toUpperCase();
}

/** Binance Futures symbol → MEXC contract symbol: "SOLUSDT" → "SOL_USDT" */
function toMexcFuturesSymbol(symbol: string): string {
  // Insert "_" before "USDT" / "BUSD" / "BTC"
  return symbol.replace(/(USDT|BUSD|BTC|ETH)$/, '_$1');
}

/** Signed compact format: "+$2.06M", "-$380K" */
export function fmtCompact(n: number): string {
  const abs  = Math.abs(n);
  const sign = n < 0 ? '-' : '+';
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(2) + 'B';
  if (abs >= 1_000_000)     return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000)         return sign + '$' + (abs / 1_000).toFixed(0) + 'K';
  return sign + '$' + abs.toFixed(0);
}

/** Linear-regression slope → trend label */
function calcOITrend(values: number[]): Pick<MarketSnapshot, 'oiTrend' | 'oiStrength'> {
  const n = values.length;
  if (n < 3) return { oiTrend: 'sideways', oiStrength: 'weak' };
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  values.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
  const slope    = den === 0 ? 0 : num / den;
  const slopePct = yMean > 0 ? (slope / yMean) * 100 : 0;
  if (slopePct >  0.25) return { oiTrend: 'rising',  oiStrength: slopePct >  1.2 ? 'strong' : slopePct >  0.6 ? 'moderate' : 'weak' };
  if (slopePct < -0.25) return { oiTrend: 'falling', oiStrength: slopePct < -1.2 ? 'strong' : slopePct < -0.6 ? 'moderate' : 'weak' };
  return { oiTrend: 'sideways', oiStrength: 'weak' };
}

/** CVD from standard Binance-format klines (index 7=quoteVol, 10=takerBuyQuote) */
function calcCVD(klines: RawKline[]): { total: number; last: number; history: number[] } {
  let cum = 0;
  const history = klines.map(k => {
    const takerBuy = parseFloat(k[10] ?? '0');
    const total    = parseFloat(k[7]  ?? '0');
    // Check if takerBuy data exists (MEXC may not include it)
    const delta = (takerBuy > 0 || total > 0) ? 2 * takerBuy - total : 0;
    cum += delta;
    return cum;
  });
  const last = history.length >= 2 ? history[history.length - 1] - history[history.length - 2] : 0;
  return { total: history[history.length - 1] ?? 0, last, history };
}

// ── Binance Futures symbol cache ──────────────────────────────────────────────
let _futuresSymbols: Set<string> | null = null;
let _cacheExpiry = 0;

export async function getBinanceFuturesSymbols(): Promise<Set<string>> {
  if (_futuresSymbols && Date.now() < _cacheExpiry) return _futuresSymbols;
  try {
    const res = await fetch(`${BN}/fapi/v1/exchangeInfo`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`exchangeInfo ${res.status}`);
    const data: { symbols: Array<{ symbol: string }> } = await res.json();
    _futuresSymbols = new Set(data.symbols.map(s => s.symbol));
    _cacheExpiry    = Date.now() + 10 * 60 * 1000;  // cache 10 min
    return _futuresSymbols;
  } catch {
    return new Set();
  }
}

export async function isBinanceFuturesPair(symbol: string): Promise<boolean> {
  const symbols = await getBinanceFuturesSymbols();
  return symbols.has(symbol.toUpperCase());
}

// ── Binance Futures fetch ─────────────────────────────────────────────────────
async function fetchBinanceOI(symbol: string): Promise<OIRecord[]> {
  const res = await fetch(
    `${BN}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=20`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`BN OI ${res.status}`);
  return res.json();
}

async function fetchBinanceKlines(symbol: string): Promise<RawKline[]> {
  const res = await fetch(
    `${BN}/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=20`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`BN Klines ${res.status}`);
  return res.json();
}

async function fetchBinanceTicker(symbol: string): Promise<Ticker24h> {
  const res = await fetch(
    `${BN}/fapi/v1/ticker/24hr?symbol=${symbol}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`BN Ticker ${res.status}`);
  return res.json();
}

async function fetchFromBinance(pair: string): Promise<MarketSnapshot> {
  const symbol = pairToSymbol(pair);
  const [oiData, klines, ticker] = await Promise.all([
    fetchBinanceOI(symbol),
    fetchBinanceKlines(symbol),
    fetchBinanceTicker(symbol),
  ]);

  const oiHistory  = oiData.map(d => parseFloat(d.sumOpenInterestValue));
  const oiFirst    = oiHistory[0]  ?? 0;
  const oiCurrent  = oiHistory[oiHistory.length - 1] ?? 0;
  const oiChangePct = oiFirst > 0 ? ((oiCurrent - oiFirst) / oiFirst) * 100 : 0;

  const cvd        = calcCVD(klines);
  const price      = parseFloat(ticker.lastPrice);
  const prevClose  = klines.length >= 2 ? parseFloat(klines[klines.length - 2][4]) : price;

  return {
    pair, symbol, price,
    priceChange24h:  parseFloat(ticker.priceChangePercent),
    priceChange5m:   prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    volume24h:       parseFloat(ticker.quoteVolume),
    oiCurrent, oiFirst, oiChangePct,
    ...calcOITrend(oiHistory),
    oiHistory,
    oiAvailable: true,
    cvdTotal:    cvd.total,
    cvdLast:     cvd.last,
    cvdHistory:  cvd.history,
    dataSource:  'binance',
    fetchedAt:   new Date().toISOString(),
  };
}

// ── MEXC fallback fetch ───────────────────────────────────────────────────────
async function fetchMexcKlines(symbol: string): Promise<RawKline[]> {
  const res = await fetch(
    `${MX}/api/v3/klines?symbol=${symbol}&interval=5m&limit=20`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`MX Klines ${res.status}`);
  return res.json();
}

async function fetchMexcTicker(symbol: string): Promise<Ticker24h> {
  const res = await fetch(
    `${MX}/api/v3/ticker/24hr?symbol=${symbol}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`MX Ticker ${res.status}`);
  return res.json();
}

async function fetchMexcFuturesOI(symbol: string): Promise<number | null> {
  try {
    const fSym = toMexcFuturesSymbol(symbol);
    const res  = await fetch(
      `${MXC}/api/v1/contract/ticker?symbol=${fSym}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const json: { data?: MexcContractTicker } = await res.json();
    const holdVol = parseFloat(json.data?.holdVol ?? '0');
    const last    = parseFloat(json.data?.lastPrice ?? '0');
    return holdVol > 0 && last > 0 ? holdVol * last : null;
  } catch {
    return null;
  }
}

async function fetchFromMexc(pair: string): Promise<MarketSnapshot> {
  const symbol = pairToSymbol(pair);
  const [klines, ticker, oiUsd] = await Promise.all([
    fetchMexcKlines(symbol),
    fetchMexcTicker(symbol),
    fetchMexcFuturesOI(symbol),
  ]);

  const cvd     = calcCVD(klines);
  const price   = parseFloat(ticker.lastPrice);
  const prevCl  = klines.length >= 2 ? parseFloat(klines[klines.length - 2][4]) : price;

  // Build a flat OI history from the single snapshot value (repeated for sparkline shape)
  const oiCurrent  = oiUsd ?? 0;
  const oiHistory  = Array.from({ length: 20 }, () => oiCurrent);

  return {
    pair, symbol, price,
    priceChange24h:  parseFloat(ticker.priceChangePercent),
    priceChange5m:   prevCl > 0 ? ((price - prevCl) / prevCl) * 100 : 0,
    volume24h:       parseFloat(ticker.quoteVolume),
    oiCurrent, oiFirst: oiCurrent, oiChangePct: 0,
    oiTrend: 'sideways', oiStrength: 'weak',
    oiHistory,
    oiAvailable: oiUsd !== null,
    cvdTotal:    cvd.total,
    cvdLast:     cvd.last,
    cvdHistory:  cvd.history,
    dataSource:  'mexc',
    fetchedAt:   new Date().toISOString(),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchMarketSnapshot(pair: string): Promise<MarketSnapshot> {
  const symbol   = pairToSymbol(pair);
  const onBinance = await isBinanceFuturesPair(symbol);

  if (onBinance) {
    return fetchFromBinance(pair);
  } else {
    return fetchFromMexc(pair);
  }
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
export function getMockSnapshot(pair: string): MarketSnapshot {
  const seed = pair.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const up   = seed % 2 === 0;
  const base = 1_800_000 + (seed % 5) * 250_000;

  const oiHistory = Array.from({ length: 20 }, (_, i) =>
    base + i * (up ? 14_000 : -9_000) + Math.sin(i * 0.9) * 25_000,
  );
  let cvd = 0;
  const cvdHistory = Array.from({ length: 20 }, (_, i) => {
    cvd += (up ? 1 : -1) * (18_000 + Math.sin(i * 1.2) * 30_000);
    return cvd;
  });
  const price = 80 + (seed % 150);

  return {
    pair,
    symbol:          pairToSymbol(pair),
    price,
    priceChange24h:  up ? 5.3 : -3.1,
    priceChange5m:   up ? 0.28 : -0.19,
    volume24h:       45_000_000 + (seed % 10) * 3_000_000,
    oiCurrent:       oiHistory[19],
    oiFirst:         oiHistory[0],
    oiChangePct:     up ? 3.2 : -2.1,
    oiTrend:         up ? 'rising' : 'falling',
    oiStrength:      'moderate',
    oiHistory,
    oiAvailable:     true,
    cvdTotal:        cvdHistory[19],
    cvdLast:         cvdHistory[19] - cvdHistory[18],
    cvdHistory,
    dataSource:      'mock',
    fetchedAt:       new Date().toISOString(),
    isMock:          true,
  };
}
