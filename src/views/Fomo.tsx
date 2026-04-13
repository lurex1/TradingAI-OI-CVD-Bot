import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Flame, RefreshCw, TrendingUp, TrendingDown,
  Minus, ShoppingCart, AlertCircle, Clock, Wifi,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchFomoCoins, MOCK_FOMO, type FomoCoin } from '../lib/coinGeckoService';
import type { Exchange } from '../types';

const REFRESH_INTERVAL = 60; // seconds

interface FomoProps {
  exchanges: Exchange[];
  onTrade:   (ticker: string) => void;
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatPrice(p: number): string {
  if (p >= 1000)  return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1)     return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 0.001) return '$' + p.toFixed(4);
  if (p >= 0.000001) return '$' + p.toFixed(7);
  return '$' + p.toExponential(2);
}

function formatChange(c: number): string {
  return (c >= 0 ? '+' : '') + c.toFixed(2) + '%';
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return '$' + (n / 1_000).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

// ── Market cap filter options ─────────────────────────────────────────────────
const MCAP_FILTERS = [
  { label: '50M',  value: 50_000_000  },
  { label: '100M', value: 100_000_000 },
  { label: '500M', value: 500_000_000 },
] as const;

// ── Sentiment badge ───────────────────────────────────────────────────────────
function SentimentBadge({ s }: { s: FomoCoin['sentiment'] }) {
  if (s === 'bullish') return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#00d68f]/12 border border-[#00d68f]/25 text-[#00d68f] shrink-0">
      <TrendingUp size={8} /> BULL
    </span>
  );
  if (s === 'bearish') return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#ff3355]/12 border border-[#ff3355]/25 text-[#ff3355] shrink-0">
      <TrendingDown size={8} /> BEAR
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#8892a4]/12 border border-[#8892a4]/20 text-[#8892a4] shrink-0">
      <Minus size={8} /> NEUT
    </span>
  );
}

// ── FOMO score colour ─────────────────────────────────────────────────────────
function fomoColor(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct > 0.65) return '#ff3355';
  if (pct > 0.35) return '#f5c518';
  return '#00d4ff';
}

// ── Coin card ─────────────────────────────────────────────────────────────────
function CoinCard({
  coin, maxScore, onTrade, trading,
}: {
  coin:     FomoCoin;
  maxScore: number;
  onTrade:  (ticker: string) => void;
  trading:  boolean;
}) {
  const color    = fomoColor(coin.fomoScore, maxScore);
  const barPct   = maxScore > 0 ? Math.round((coin.fomoScore / maxScore) * 100) : 0;

  const rankColor =
    coin.rank === 1 ? '#f5c518' :
    coin.rank === 2 ? '#94a3b8' :
    coin.rank === 3 ? '#b45309' : '#3d4e65';

  const changeColor = coin.priceChange24h >= 0 ? '#00d68f' : '#ff3355';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(0,212,255,0.15)] bg-[#0d1526] transition-all hover:border-[rgba(0,212,255,0.3)]">
      {/* FOMO bar background */}
      <div
        className="absolute inset-y-0 left-0 opacity-[0.055] pointer-events-none transition-all duration-700"
        style={{ width: `${barPct}%`, background: color }}
      />

      <div className="relative px-3 py-3">
        {/* ── Row 1: rank · thumb · name · price · change · [score desktop] · button ── */}
        <div className="flex items-center gap-2.5">
          {/* Rank */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs border"
            style={{ color: rankColor, borderColor: rankColor + '30', background: rankColor + '12' }}
          >
            {coin.rank}
          </div>

          {/* Thumb */}
          <div className="w-9 h-9 rounded-xl bg-[#0a0f1e] border border-[rgba(0,212,255,0.12)] flex items-center justify-center shrink-0 overflow-hidden">
            {coin.thumb
              ? <img src={coin.thumb} alt={coin.ticker} className="w-6 h-6 rounded-full" />
              : <span className="text-[9px] font-bold text-[#00d4ff]">{coin.ticker.slice(0, 4)}</span>
            }
          </div>

          {/* Name + ticker + sentiment */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-bold text-white truncate leading-none">{coin.name}</span>
              <span className="text-[9px] font-mono text-[#8892a4] shrink-0">{coin.ticker}</span>
            </div>
            <div className="flex items-center gap-2">
              <SentimentBadge s={coin.sentiment} />
              <span className="text-[11px] font-mono text-white">{formatPrice(coin.price)}</span>
              <span className="text-[11px] font-bold" style={{ color: changeColor }}>
                {formatChange(coin.priceChange24h)}
              </span>
            </div>
          </div>

          {/* FOMO score — desktop */}
          <div className="text-right shrink-0 mx-1 hidden sm:block">
            <div className="text-[9px] text-[#8892a4] mb-0.5 uppercase tracking-wider">FOMO</div>
            <div className="text-lg font-black tabular-nums leading-none" style={{ color }}>
              {coin.fomoScore}
            </div>
          </div>

          {/* Trade button */}
          <button
            onClick={() => onTrade(coin.ticker)}
            disabled={trading}
            className={cn(
              'h-8 px-2.5 rounded-xl text-xs font-semibold border transition-all shrink-0 flex items-center gap-1.5',
              'bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#00d4ff]',
              'hover:bg-[#0ea5e9]/20 hover:border-[#0ea5e9]/50',
              trading && 'opacity-50 cursor-not-allowed',
            )}
          >
            {trading
              ? <span className="w-3 h-3 border border-[#00d4ff]/40 border-t-[#00d4ff] rounded-full animate-spin" />
              : <ShoppingCart size={10} />
            }
            Handluj
          </button>
        </div>

        {/* ── Row 2: mcap · volume · [fomo mobile] ── */}
        <div className="flex items-center gap-3 mt-2 pl-[4.25rem]">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-[#8892a4] uppercase tracking-wider">MCap</span>
            <span className="text-[11px] font-mono text-[#aabbcc]">{formatCompact(coin.marketCap)}</span>
          </div>
          <span className="text-[#2a3a55]">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-[#8892a4] uppercase tracking-wider">Vol</span>
            <span className="text-[11px] font-mono text-[#aabbcc]">{formatCompact(coin.volume24h)}</span>
          </div>
          <span className="text-[#2a3a55]">·</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-[#8892a4] uppercase tracking-wider">V/M</span>
            <span className="text-[11px] font-mono text-[#aabbcc]">
              {coin.marketCap > 0 ? (coin.volume24h / coin.marketCap * 100).toFixed(0) + '%' : '—'}
            </span>
          </div>

          {/* FOMO score mobile */}
          <div className="sm:hidden flex items-center gap-1 ml-auto">
            <span className="text-[9px] text-[#8892a4] uppercase">FOMO</span>
            <span className="text-sm font-black" style={{ color }}>{coin.fomoScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function Fomo({ exchanges, onTrade }: FomoProps) {
  const [coins, setCoins]           = useState<FomoCoin[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown]   = useState(REFRESH_INTERVAL);
  const [tradingTicker, setTrading] = useState<string | null>(null);
  const [maxMcap, setMaxMcap]       = useState<number>(100_000_000);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mcapRef   = useRef(maxMcap);
  mcapRef.current = maxMcap;

  const connectedCex = exchanges.find(e => e.connected && e.type === 'CEX');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCountdown(REFRESH_INTERVAL);
    try {
      const data = await fetchFomoCoins(mcapRef.current);
      setCoins(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (msg === 'ratelimit') {
        setError('Przekroczono limit zapytań CoinGecko (30/min). Odczekaj chwilę.');
      } else if (msg.startsWith('http_')) {
        setError(`Błąd API CoinGecko (${msg.replace('http_', '')}). Spróbuj za chwilę.`);
      } else {
        setError('Brak połączenia z CoinGecko API. Sprawdź internet.');
      }
      setCoins(prev => prev.length === 0 ? MOCK_FOMO : prev);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Start intervals helper ─────────────────────────────────────────────────
  const startIntervals = useCallback(() => {
    timerRef.current = setInterval(doFetch, REFRESH_INTERVAL * 1000);
    countRef.current = setInterval(() => {
      setCountdown(c => (c <= 1 ? REFRESH_INTERVAL : c - 1));
    }, 1000);
  }, [doFetch]);

  const clearIntervals = () => {
    clearInterval(timerRef.current!);
    clearInterval(countRef.current!);
  };

  // Initial load
  useEffect(() => {
    doFetch();
    startIntervals();
    return clearIntervals;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when filter changes
  useEffect(() => {
    clearIntervals();
    doFetch();
    startIntervals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxMcap]);

  const handleManualRefresh = () => {
    clearIntervals();
    doFetch();
    startIntervals();
  };

  const handleTrade = useCallback((ticker: string) => {
    setTrading(ticker);
    setTimeout(() => { setTrading(null); onTrade(ticker); }, 300);
  }, [onTrade]);

  const maxScore = coins.length > 0 ? Math.max(...coins.map(c => c.fomoScore)) : 1;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="w-full min-h-full pb-24 lg:pb-6">

      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-[#ff3355] shrink-0" />
            <h1 className="text-xl font-bold text-white">FOMO Scanner</h1>
            <span className="hidden sm:flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#00d68f]/12 border border-[#00d68f]/25 text-[#00d68f]">
              <Wifi size={7} /> CoinGecko Live
            </span>
          </div>
          <p className="text-sm text-[#8892a4] mt-0.5">
            Top 10 · zmiana 24h &gt; 10% · vol &gt; $500K · auto-odśw. co {REFRESH_INTERVAL}s
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Countdown ring */}
          <div className="hidden sm:flex flex-col items-center gap-0.5">
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="13" fill="none"
                  stroke="#00d4ff" strokeWidth="3"
                  strokeDasharray={String(2 * Math.PI * 13)}
                  strokeDashoffset={String(2 * Math.PI * 13 * (1 - countdown / REFRESH_INTERVAL))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#00d4ff]">
                {countdown}
              </span>
            </div>
          </div>

          {lastUpdated && (
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#8892a4]">
              <Clock size={10} />
              {formatTime(lastUpdated)}
            </div>
          )}

          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className={cn(
              'h-9 px-4 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
              'bg-[#0ea5e9]/10 border-[#0ea5e9]/25 text-[#00d4ff]',
              'hover:bg-[#0ea5e9]/20',
              loading && 'opacity-60 cursor-not-allowed',
            )}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Odśwież
          </button>
        </div>
      </div>

      <div className="px-4 py-5 max-w-2xl space-y-4">

        {/* ── Filter bar ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider shrink-0">
            Max Market Cap:
          </span>
          {MCAP_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setMaxMcap(value)}
              className={cn(
                'h-7 px-3 rounded-lg text-xs font-bold border transition-all',
                maxMcap === value
                  ? 'bg-[#0ea5e9]/20 border-[#0ea5e9]/50 text-[#00d4ff]'
                  : 'bg-transparent border-[rgba(0,212,255,0.15)] text-[#8892a4] hover:border-[rgba(0,212,255,0.3)] hover:text-white',
              )}
            >
              ${label}
            </button>
          ))}
          {loading && (
            <span className="text-[10px] text-[#8892a4] flex items-center gap-1 ml-1">
              <RefreshCw size={9} className="animate-spin" /> ładowanie…
            </span>
          )}
        </div>

        {/* No exchange warning */}
        {!connectedCex && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#ff3355]/6 border border-[#ff3355]/18">
            <AlertCircle size={13} className="text-[#ff3355] shrink-0" />
            <p className="text-[11px] text-[#9a3040] leading-relaxed">
              Brak połączonej giełdy CEX. Przycisk{' '}
              <strong className="text-[#ff7090]">Handluj</strong> wymaga połączenia
              w zakładce <strong className="text-[#ff7090]">Giełdy</strong>.
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[#ff3355]/8 border border-[#ff3355]/20">
            <AlertCircle size={14} className="text-[#ff3355] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#ff3355]">Błąd pobierania danych</p>
              <p className="text-xs text-[#ff3355]/70 mt-0.5">{error}</p>
              <p className="text-xs text-[#8892a4] mt-1">Wyświetlam przykładowe dane.</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && coins.length === 0 && (
          <div className="space-y-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-[86px] rounded-2xl bg-[#0d1526] border border-[rgba(0,212,255,0.08)] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state (no coins after filter) */}
        {!loading && coins.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Flame size={32} className="text-[#3d4e65]" />
            <p className="text-sm font-semibold text-[#8892a4]">Brak coinów spełniających kryteria</p>
            <p className="text-xs text-[#3d4e65] max-w-xs">
              Przy aktualnym filtrze (&lt;${(maxMcap / 1_000_000).toFixed(0)}M) nie znaleziono coinów
              ze wzrostem &gt;10% i wolumenem &gt;$500K. Spróbuj zwiększyć limit market cap.
            </p>
            <button
              onClick={() => setMaxMcap(500_000_000)}
              className="mt-1 h-8 px-4 rounded-lg text-xs font-semibold bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#00d4ff] hover:bg-[#0ea5e9]/20 transition-all"
            >
              Zwiększ do $500M
            </button>
          </div>
        )}

        {/* Coin list */}
        {coins.length > 0 && (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider">
                Coin · Cena · Zmiana 24h · MCap · Vol
              </span>
              <span className="text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider hidden sm:block">
                FOMO Score
              </span>
            </div>

            {coins.map(coin => (
              <CoinCard
                key={coin.ticker + coin.rank}
                coin={coin}
                maxScore={maxScore}
                onTrade={handleTrade}
                trading={tradingTicker === coin.ticker}
              />
            ))}
          </div>
        )}

        {/* Legend + source + mobile time */}
        {coins.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#8892a4]">FOMO:</span>
                {([['#ff3355','Wysoki'], ['#f5c518','Średni'], ['#00d4ff','Niski']] as [string,string][]).map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: c }} />
                    <span className="text-[#8892a4]">{l}</span>
                  </span>
                ))}
              </div>
              <a
                href="https://www.coingecko.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#8892a4] hover:text-[#00d4ff] transition-colors"
              >
                Dane: CoinGecko
              </a>
            </div>

            {/* Mobile: last updated + countdown */}
            {lastUpdated && (
              <div className="flex items-center justify-between text-[11px] text-[#8892a4] sm:hidden">
                <div className="flex items-center gap-1.5">
                  <Clock size={10} />
                  {formatTime(lastUpdated)}
                </div>
                <span>Następne: {countdown}s</span>
              </div>
            )}
          </div>
        )}

        {/* FOMO score formula info */}
        <div className="p-3 rounded-xl bg-[#0d1526] border border-[rgba(0,212,255,0.1)]">
          <p className="text-[10px] text-[#8892a4] leading-relaxed">
            <span className="text-[#00d4ff] font-semibold">Formuła FOMO Score:</span>{' '}
            (zmiana_24h × 0.5) + (Vol/MCap × 30) + (niski_cap × 20) ·
            Filtr: MCap &lt; ${(maxMcap / 1_000_000).toFixed(0)}M · Wzrost &gt; 10% · Vol &gt; $500K
          </p>
        </div>

      </div>
    </div>
  );
}
