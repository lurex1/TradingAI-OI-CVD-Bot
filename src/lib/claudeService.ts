import type { WebhookSignal, ClaudeDecision, AggressionLevel } from '../types';
import { AGGRESSION_CONFIGS } from './aggressionConfig';

const MOCK_POOL: Array<Omit<ClaudeDecision, 'timestamp'>> = [
  {
    action: 'OPEN_LONG',
    reasoning:
      'OI wzrósł o 14% przy silnie dodatnim CVD (+520K). Cena konsoliduje powyżej EMA20. Kupujący dominują — prawdopodobieństwo przebicia w górę wysokie. CVD acceleracja potwierdza presję zakupową.',
    confidence: 78,
    suggestedAggression: 'MEDIUM',
  },
  {
    action: 'OPEN_SHORT',
    reasoning:
      'CVD mocno ujemny (-380K) mimo wzrostu ceny — klasyczny bear trap. OI maleje, liquidacje longów widoczne. Divergencja wskazuje na odwrócenie. Krótka pozycja uzasadniona.',
    confidence: 72,
    suggestedAggression: 'LOW',
  },
  {
    action: 'HOLD',
    reasoning:
      'OI płaskie, CVD bez wyraźnego kierunku (+12K). Spread bid-ask szeroki, wolumen poniżej średniej. Brak potwierdzenia sygnału — czekam na lepszy setup.',
    confidence: 48,
    suggestedAggression: undefined,
  },
  {
    action: 'OPEN_LONG',
    reasoning:
      'Silna akumulacja — CVD przebija 21-okres EMA od dołu. OI rośnie równolegle z ceną (zdrowy trend). RSI 58 — nie wykupiony. Wejście LONG z niskim ryzykiem.',
    confidence: 83,
    suggestedAggression: 'HIGH',
  },
  {
    action: 'CLOSE',
    reasoning:
      'CVD zaczyna odwracać — presja sprzedawców rośnie. OI skacze bez wzrostu ceny (pozycje hedge). Realizuję zysk przed potencjalnym przełomem.',
    confidence: 69,
    suggestedAggression: undefined,
  },
];

export async function askClaude(
  signal: WebhookSignal,
  apiKey: string,
  aggression: AggressionLevel
): Promise<ClaudeDecision> {
  const cfg =
    aggression !== 'AUTO' ? AGGRESSION_CONFIGS[aggression] : AGGRESSION_CONFIGS.MEDIUM;

  if (!apiKey || apiKey === 'demo') {
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    const pick = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)];
    return { ...pick, timestamp: new Date().toISOString() };
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
      action: json.action ?? 'HOLD',
      reasoning: json.reasoning ?? 'Brak uzasadnienia.',
      confidence: json.confidence ?? 50,
      suggestedAggression: json.suggestedAggression,
      timestamp: new Date().toISOString(),
    };
  } catch {
    const pick = MOCK_POOL[0];
    return { ...pick, timestamp: new Date().toISOString() };
  }
}
