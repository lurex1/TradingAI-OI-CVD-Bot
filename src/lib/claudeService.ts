import type { WebhookSignal, ClaudeDecision, AggressionLevel } from '../types';
import { AGGRESSION_CONFIGS } from './aggressionConfig';
import { fmtCompact, type MarketSnapshot } from './binanceFuturesService';

const MOCK_POOL: Array<Omit<ClaudeDecision, 'timestamp'>> = [
  {
    action: 'OPEN_LONG',
    reasoning: 'OI wzrósł o 14% przy silnie dodatnim CVD (+520K). Kupujący dominują — przebicie w górę prawdopodobne.',
    confidence: 78,
    suggestedAggression: 'MEDIUM',
  },
  {
    action: 'OPEN_SHORT',
    reasoning: 'CVD mocno ujemny (-380K) mimo wzrostu ceny — bear trap. OI maleje, divergencja wskazuje odwrócenie.',
    confidence: 72,
    suggestedAggression: 'LOW',
  },
  {
    action: 'HOLD',
    reasoning: 'OI płaskie, CVD bez kierunku (+12K). Wolumen poniżej średniej — czekam na potwierdzenie sygnału.',
    confidence: 48,
    suggestedAggression: undefined,
  },
  {
    action: 'OPEN_LONG',
    reasoning: 'CVD przebija EMA od dołu, OI rośnie równolegle z ceną. Zdrowy trend wzrostowy — LONG uzasadniony.',
    confidence: 83,
    suggestedAggression: 'HIGH',
  },
  {
    action: 'CLOSE',
    reasoning: 'CVD odwraca się, presja sprzedawców rośnie. OI skok bez wzrostu ceny — realizuję zysk.',
    confidence: 69,
    suggestedAggression: undefined,
  },
];

// ── Legacy: used when no MarketSnapshot is available ─────────────────────────
export async function askClaude(
  signal: WebhookSignal,
  apiKey: string,
  aggression: AggressionLevel,
): Promise<ClaudeDecision> {
  const cfg = aggression !== 'AUTO' ? AGGRESSION_CONFIGS[aggression] : AGGRESSION_CONFIGS.MEDIUM;

  if (!apiKey || apiKey === 'demo') {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    return { ...MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)], timestamp: new Date().toISOString() };
  }

  const prompt = `Jesteś botem tradingowym. Analiza ${signal.pair}:
Cena: ${signal.price} USDT
OI delta: ${signal.oi > 0 ? '+' : ''}${signal.oi.toLocaleString()}
CVD: ${signal.cvd > 0 ? '+' : ''}${signal.cvd.toLocaleString()}
Wolumen: ${signal.volume.toLocaleString()} USDT
Parametry: SL ${cfg.sl}%, TP ${cfg.tp}%, dźwignia ${cfg.leverage}x

Zdecyduj: OPEN_LONG, OPEN_SHORT, CLOSE lub HOLD.
Odpowiedz TYLKO JSON: {"action":"...","reasoning":"...","confidence":0-100,"suggestedAggression":"LOW|MEDIUM|HIGH"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const text: string = data.content[0].text;
    const json = JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] ?? '{}');
    return {
      action:              json.action ?? 'HOLD',
      reasoning:           json.reasoning ?? 'Brak uzasadnienia.',
      confidence:          json.confidence ?? 50,
      suggestedAggression: json.suggestedAggression,
      timestamp:           new Date().toISOString(),
    };
  } catch {
    return { ...MOCK_POOL[0], timestamp: new Date().toISOString() };
  }
}

// ── Primary: full MarketSnapshot → richer prompt ──────────────────────────────
export async function askClaudeWithSnapshot(
  snapshot: MarketSnapshot,
  apiKey: string,
  aggression: AggressionLevel,
): Promise<ClaudeDecision> {
  const cfg = aggression !== 'AUTO' ? AGGRESSION_CONFIGS[aggression] : AGGRESSION_CONFIGS.MEDIUM;

  if (!apiKey || apiKey === 'demo') {
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
    // Context-aware mock pick
    let pick: Omit<ClaudeDecision, 'timestamp'>;
    if (snapshot.oiTrend === 'rising' && snapshot.cvdTotal > 0)   pick = MOCK_POOL[0];
    else if (snapshot.oiTrend === 'falling' || snapshot.cvdTotal < -50_000) pick = MOCK_POOL[1];
    else pick = MOCK_POOL[2];
    return { ...pick, timestamp: new Date().toISOString() };
  }

  const srcNote = snapshot.dataSource === 'binance'
    ? 'Binance Futures'
    : snapshot.dataSource === 'mexc'
    ? 'MEXC (para niedostępna na Binance Futures)'
    : 'dane demo';

  const oiLine = snapshot.oiAvailable
    ? `Aktualny: $${(snapshot.oiCurrent / 1_000_000).toFixed(2)}M | zmiana: ${snapshot.oiChangePct >= 0 ? '+' : ''}${snapshot.oiChangePct.toFixed(2)}% | trend: ${snapshot.oiTrend} (${snapshot.oiStrength})`
    : 'Niedostępny dla tej pary';

  const prompt = `Jesteś precyzyjnym botem tradingowym dla rynku krypto futures.

Para: ${snapshot.pair} | Źródło danych: ${srcNote}
CENA: $${snapshot.price.toFixed(4)} USDT
  → zmiana 5min: ${snapshot.priceChange5m >= 0 ? '+' : ''}${snapshot.priceChange5m.toFixed(2)}%
  → zmiana 24h:  ${snapshot.priceChange24h >= 0 ? '+' : ''}${snapshot.priceChange24h.toFixed(2)}%

OPEN INTEREST (ostatnie 20 świec 5min):
  ${oiLine}

CVD — Cumulative Volume Delta (ostatnie 20 świec 5min):
  Skumulowany: ${fmtCompact(snapshot.cvdTotal)} USDT  →  ${snapshot.cvdTotal > 50_000 ? 'KUPUJĄCY dominują' : snapshot.cvdTotal < -50_000 ? 'SPRZEDAJĄCY dominują' : 'rynek wyrównany'}
  Ostatnia świeca: ${fmtCompact(snapshot.cvdLast)} USDT

WOLUMEN 24h: $${(snapshot.volume24h / 1_000_000).toFixed(1)}M USDT

Parametry bota: SL ${cfg.sl}%, TP ${cfg.tp}%, dźwignia ${cfg.leverage}x

Klucze interpretacji:
• OI ↑ + CVD > 0  → kupujący akumulują pozycje → LONG
• OI ↑ + CVD < 0  → niedźwiedzie hedgują → SHORT lub HOLD
• OI ↓           → deleveraging, ostrożność
• CVD neutral     → brak kierunku → HOLD

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez komentarzy, bez markdown):
{"action":"OPEN_LONG|OPEN_SHORT|CLOSE|HOLD","reasoning":"po polsku, max 120 znaków, konkretne","confidence":0-100,"suggestedAggression":"LOW|MEDIUM|HIGH"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data  = await res.json();
    const text: string = data.content[0].text;
    const json  = JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] ?? '{}');
    return {
      action:              json.action    ?? 'HOLD',
      reasoning:           json.reasoning ?? 'Brak uzasadnienia.',
      confidence:          json.confidence ?? 50,
      suggestedAggression: json.suggestedAggression,
      timestamp:           new Date().toISOString(),
    };
  } catch {
    return { ...MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)], timestamp: new Date().toISOString() };
  }
}
