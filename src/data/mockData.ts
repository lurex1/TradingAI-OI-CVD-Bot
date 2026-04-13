import type { Exchange, ClosedTrade } from '../types';

export const defaultExchanges: Exchange[] = [
  { id: 'mexc',          name: 'MEXC',          type: 'CEX', logo: 'M',  connected: false },
  { id: 'binance',       name: 'Binance',        type: 'CEX', logo: 'B',  connected: false },
  { id: 'bybit',         name: 'Bybit',          type: 'CEX', logo: 'By', connected: false },
  { id: 'okx',           name: 'OKX',            type: 'CEX', logo: 'O',  connected: false },
  { id: 'kraken',        name: 'Kraken',         type: 'CEX', logo: 'K',  connected: false },
  { id: 'metamask',      name: 'MetaMask',       type: 'DEX', logo: 'MM', connected: false },
  { id: 'walletconnect', name: 'WalletConnect',  type: 'DEX', logo: 'WC', connected: false },
];

const t = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

export const mockTrades: ClosedTrade[] = [
  {
    id: 'tr1',
    pair: 'SOL/USDT',
    exchange: 'bybit',
    side: 'LONG',
    entryPrice: 142.30,
    closePrice: 148.42,
    leverage: 5,
    pnl: 215.40,
    pnlPercent: 4.30,
    openedAt: t(95),
    closedAt: t(20),
    closeReason: 'TP',
    aggressionLevel: 'MEDIUM',
    claudeAnalysis:
      'OI wzrósł o 14% przy dodatnim CVD +520K. Cena konsolidowała powyżej EMA20 przez 3 godziny — klasyczny breakout setup. Otwierałem LONG z SL 3% / TP 6%. Pozycja zamknięta na TP.',
  },
  {
    id: 'tr2',
    pair: 'BTC/USDT',
    exchange: 'binance',
    side: 'SHORT',
    entryPrice: 68_420.00,
    closePrice: 69_250.00,
    leverage: 3,
    pnl: -149.30,
    pnlPercent: -1.21,
    openedAt: t(320),
    closedAt: t(290),
    closeReason: 'SL',
    aggressionLevel: 'LOW',
    claudeAnalysis:
      'CVD ujemny -380K przy wzroście ceny — sygnał bear trap. Niestety cena kontynuowała ruch w górę przekraczając SL 2%. Analiza wykazała błędną interpretację wolumenu. Lekcja: w silnym trendzie shortowanie wymaga dodatkowego potwierdzenia.',
  },
  {
    id: 'tr3',
    pair: 'ETH/USDT',
    exchange: 'binance',
    side: 'LONG',
    entryPrice: 3_248.50,
    closePrice: 3_447.20,
    leverage: 5,
    pnl: 497.70,
    pnlPercent: 6.12,
    openedAt: t(1440),
    closedAt: t(720),
    closeReason: 'TP',
    aggressionLevel: 'MEDIUM',
    claudeAnalysis:
      'Silna akumulacja widoczna na CVD — fast EMA przebiła slow EMA od dołu. OI rośnie równolegle z ceną (zdrowy bullish trend). RSI 54 — nie wykupiony. Wejście LONG potwierdzone przez triple EMA alignment (EMA20>EMA50>EMA200). TP osiągnięty.',
  },
  {
    id: 'tr4',
    pair: 'SOL/USDT',
    exchange: 'bybit',
    side: 'SHORT',
    entryPrice: 155.80,
    closePrice: 152.30,
    leverage: 10,
    pnl: 224.80,
    pnlPercent: 2.25,
    openedAt: t(2880),
    closedAt: t(2800),
    closeReason: 'CLAUDE',
    aggressionLevel: 'HIGH',
    claudeAnalysis:
      'Wykryłem gwałtowny wzrost OI bez odpowiadającego ruchu ceny (+8% OI, cena +0.3%). CVD zaczął odwracać. Zamknąłem pozycję przed SL na podstawie analizy wolumenu — dobra decyzja, cena wróciła do 160 po 2h.',
  },
  {
    id: 'tr5',
    pair: 'BNB/USDT',
    exchange: 'mexc',
    side: 'LONG',
    entryPrice: 412.00,
    closePrice: 411.18,
    leverage: 3,
    pnl: -12.30,
    pnlPercent: -0.20,
    openedAt: t(4320),
    closedAt: t(4300),
    closeReason: 'MANUAL',
    aggressionLevel: 'LOW',
    claudeAnalysis:
      'Sygnał był neutralny (CVD +45K, OI bez zmian). Pozycja zamknięta manualnie przez użytkownika. Brak wyraźnego uzasadnienia technicznego dla wejścia — kolejnym razem warto poczekać na silniejszy sygnał CVD.',
  },
];
