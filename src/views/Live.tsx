import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Square, Zap, ArrowUpRight, ArrowDownRight,
  ChevronRight, BrainCircuit, RefreshCw, Database, AlertCircle,
} from 'lucide-react';
import { cn, formatPrice, formatPnl, formatPercent, formatCountdown, tvSymbol, pnlColor, timeAgo } from '../lib/utils';
import { AGGRESSION_CONFIGS, computeEffectiveAggression, calculateSLTP } from '../lib/aggressionConfig';
import { askClaudeWithSnapshot }  from '../lib/claudeService';
import { fetchMarketSnapshot, getMockSnapshot, fmtCompact, type MarketSnapshot } from '../lib/binanceFuturesService';
import type { BotState, ClosedTrade, AggressionLevel } from '../types';

declare global {
  interface Window { TradingView: { widget: new (cfg: Record<string, unknown>) => void } }
}

interface LiveProps {
  botState:          BotState;
  onStopBot:         () => void;
  onPositionClose:   (trade: ClosedTrade) => void;
  onBotStateUpdate:  (updater: (prev: BotState) => BotState) => void;
  claudeApiKey:      string;
  onGoStart:         () => void;
}

// ── Mini SVG sparkline ────────────────────────────────────────────────────────
function Sparkline({ values, color, w = 64, h = 26 }: { values: number[]; color: string; w?: number; h?: number }) {
  if (values.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const pad = 2;
  const pts = values
    .map((v, i) => `${pad + (i / (values.length - 1)) * (w - pad * 2)},${pad + (1 - (v - min) / rng) * (h - pad * 2)}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible opacity-75 shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── OI + CVD metrics strip ────────────────────────────────────────────────────
function MetricBlock({
  label, value, sub, subColor, sparkData, sparkColor, dimmed,
}: {
  label: string; value: string; sub?: string; subColor?: string;
  sparkData?: number[]; sparkColor?: string; dimmed?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2 bg-[#0d1526] rounded-xl px-3 py-2 border border-[rgba(0,212,255,0.1)] min-w-0', dimmed && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-semibold text-[#8892a4] uppercase tracking-wider mb-0.5 truncate">{label}</div>
        <div className="text-sm font-bold text-white tabular-nums leading-tight truncate">{value}</div>
        {sub && <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: subColor }}>{sub}</div>}
      </div>
      {sparkData && sparkData.length > 1 && sparkColor && (
        <Sparkline values={sparkData} color={sparkColor} />
      )}
    </div>
  );
}

function OICVDStrip({ snapshot, loading }: { snapshot: MarketSnapshot | null; loading: boolean }) {
  if (loading && !snapshot) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] shrink-0">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-[58px] rounded-xl bg-[#0d1526] animate-pulse border border-[rgba(0,212,255,0.08)]" />
        ))}
      </div>
    );
  }
  if (!snapshot) return null;

  const oiColor   = snapshot.oiTrend === 'rising'  ? '#00d68f'
                  : snapshot.oiTrend === 'falling' ? '#ff3355' : '#f5c518';
  const cvdColor  = snapshot.cvdTotal >= 0 ? '#00d68f' : '#ff3355';
  const p5mColor  = snapshot.priceChange5m >= 0 ? '#00d68f' : '#ff3355';

  const oiTrendLabel = snapshot.oiTrend === 'rising'  ? '↑ ROSNĄCY'
                     : snapshot.oiTrend === 'falling' ? '↓ SPADAJĄCY' : '→ BOCZNY';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] shrink-0">
      {/* OI */}
      <MetricBlock
        label="Open Interest"
        value={`$${(snapshot.oiCurrent / 1_000_000).toFixed(2)}M`}
        sub={snapshot.oiAvailable
          ? `${snapshot.oiChangePct >= 0 ? '+' : ''}${snapshot.oiChangePct.toFixed(1)}%  ${oiTrendLabel}`
          : 'niedostępny'}
        subColor={oiColor}
        sparkData={snapshot.oiAvailable ? snapshot.oiHistory : undefined}
        sparkColor={oiColor}
        dimmed={!snapshot.oiAvailable}
      />
      {/* CVD */}
      <MetricBlock
        label="CVD (Volume Delta)"
        value={fmtCompact(snapshot.cvdTotal)}
        sub={snapshot.cvdTotal > 50_000 ? '● KUPNO dominuje' : snapshot.cvdTotal < -50_000 ? '● SPRZEDAŻ dominuje' : '● Rynek wyrównany'}
        subColor={cvdColor}
        sparkData={snapshot.cvdHistory}
        sparkColor={cvdColor}
      />
      {/* Price */}
      <MetricBlock
        label={`Cena / 5min zmiana`}
        value={formatPrice(snapshot.price)}
        sub={`${snapshot.priceChange5m >= 0 ? '+' : ''}${snapshot.priceChange5m.toFixed(2)}%  (24h ${snapshot.priceChange24h >= 0 ? '+' : ''}${snapshot.priceChange24h.toFixed(1)}%)`}
        subColor={p5mColor}
      />
      {/* Volume */}
      <MetricBlock
        label="Wolumen 24h"
        value={`$${(snapshot.volume24h / 1_000_000).toFixed(1)}M`}
        sub={`Ostatnia świeca: ${fmtCompact(snapshot.cvdLast)}`}
        subColor="#8892a4"
      />
    </div>
  );
}

// ── Data source badge ─────────────────────────────────────────────────────────
function DataSourceBadge({ snapshot, loading, error }: { snapshot: MarketSnapshot | null; loading: boolean; error: string | null }) {
  if (loading) return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#070c1a] border-t border-[rgba(0,212,255,0.08)] shrink-0">
      <RefreshCw size={9} className="text-[#8892a4] animate-spin" />
      <span className="text-[9px] text-[#8892a4]">Pobieranie danych rynkowych…</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#070c1a] border-t border-[rgba(0,212,255,0.08)] shrink-0">
      <AlertCircle size={9} className="text-[#ff3355]" />
      <span className="text-[9px] text-[#ff3355]">{error}</span>
      {snapshot?.isMock && <span className="text-[9px] text-[#8892a4] ml-1">· Wyświetlam dane demo</span>}
    </div>
  );

  if (!snapshot) return null;

  const { dataSource, fetchedAt, isMock } = snapshot;
  const sourceLabel =
    dataSource === 'binance' ? 'Dane OI+CVD: Binance Futures' :
    dataSource === 'mexc'    ? 'Dane OI+CVD: MEXC (para niedostępna na Binance Futures)' :
    'Dane demo (API niedostępne)';
  const sourceColor =
    dataSource === 'binance' ? '#00d68f' :
    dataSource === 'mexc'    ? '#f5c518' : '#8892a4';
  const time = new Date(fetchedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#070c1a] border-t border-[rgba(0,212,255,0.08)] shrink-0">
      <Database size={9} style={{ color: sourceColor }} />
      <span className="text-[9px] font-semibold" style={{ color: sourceColor }}>{sourceLabel}</span>
      {isMock && (
        <span className="text-[9px] bg-[#f5c518]/10 border border-[#f5c518]/20 text-[#f5c518] px-1.5 rounded">DEMO</span>
      )}
      <span className="text-[9px] text-[#3d4e65] ml-auto">aktualizacja: {time}</span>
    </div>
  );
}

// ── Claude decision banner ────────────────────────────────────────────────────
type ClaudeDecision = {
  action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'HOLD';
  reasoning: string;
  confidence: number;
  timestamp: string;
};

const ACTION_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  OPEN_LONG:  { color: '#00d68f', bg: '#00d68f18', border: '#00d68f30', label: 'LONG ↑' },
  OPEN_SHORT: { color: '#ff3355', bg: '#ff335518', border: '#ff335530', label: 'SHORT ↓' },
  CLOSE:      { color: '#f5c518', bg: '#f5c51818', border: '#f5c51830', label: 'ZAMKNIJ' },
  HOLD:       { color: '#8892a4', bg: '#8892a418', border: '#8892a430', label: 'CZEKAJ' },
};

function ClaudeDecisionBanner({ decision, thinking }: { decision: ClaudeDecision | null; thinking: boolean }) {
  if (thinking) return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] shrink-0">
      <div className="w-6 h-6 rounded-lg bg-[#f5c518]/10 border border-[#f5c518]/20 flex items-center justify-center shrink-0">
        <div className="w-3 h-3 border-2 border-[#f5c518]/30 border-t-[#f5c518] rounded-full animate-spin" />
      </div>
      <p className="text-xs font-semibold text-[#f5c518]">Claude analizuje OI + CVD…</p>
    </div>
  );

  if (!decision) return null;
  const s = ACTION_STYLE[decision.action] ?? ACTION_STYLE.HOLD;
  const time = new Date(decision.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] shrink-0">
      <BrainCircuit size={13} className="text-[#00d4ff] shrink-0" />
      <div
        className="text-xs font-black px-2.5 py-1 rounded-lg border shrink-0 tabular-nums"
        style={{ color: s.color, background: s.bg, borderColor: s.border }}
      >
        {s.label}
      </div>
      <span className="text-[10px] font-semibold text-[#8892a4] shrink-0">{decision.confidence}%</span>
      <p className="text-[11px] text-[#aabbcc] italic truncate flex-1 min-w-0">{decision.reasoning}</p>
      <span className="text-[10px] text-[#3d4e65] shrink-0">{time}</span>
    </div>
  );
}

// ── TradingView chart ─────────────────────────────────────────────────────────
function TVChart({ pair, exchangeId }: { pair: string; exchangeId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pair || !containerRef.current) return;
    const id = 'tv_' + pair.replace('/', '') + '_' + exchangeId;

    const init = () => {
      if (!window.TradingView || !containerRef.current) return;
      containerRef.current.innerHTML = `<div id="${id}" style="height:100%;width:100%;"></div>`;
      new window.TradingView.widget({
        autosize:            true,
        symbol:              tvSymbol(pair, exchangeId),
        interval:            '5',
        timezone:            'Etc/UTC',
        theme:               'dark',
        style:               '1',
        locale:              'en',
        toolbar_bg:          '#070c1a',
        enable_publishing:   false,
        hide_side_toolbar:   false,
        allow_symbol_change: false,
        save_image:          false,
        container_id:        id,
        backgroundColor:     '#0a0f1e',
        gridColor:           'rgba(26,42,69,0.4)',
        disabled_features:   ['use_localstorage_for_settings', 'header_symbol_search', 'header_compare'],
      });
    };

    if (window.TradingView) { init(); return; }
    let script = document.getElementById('tv-script') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id    = 'tv-script';
      script.src   = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
  }, [pair, exchangeId]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0f1e] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-[#8892a4]">
        <div className="w-5 h-5 border-2 border-[rgba(0,212,255,0.15)] border-t-[#00d4ff] rounded-full animate-spin" />
        <span className="text-xs">Ładowanie wykresu…</span>
      </div>
    </div>
  );
}

// ── Aggression badge ──────────────────────────────────────────────────────────
function AggrBadge({ level, effective }: { level: AggressionLevel; effective: Exclude<AggressionLevel, 'AUTO'> }) {
  const map: Record<string, string> = {
    LOW:    'text-[#00d68f] bg-[#00d68f]/10 border-[#00d68f]/25',
    MEDIUM: 'text-[#f5c518] bg-[#f5c518]/10 border-[#f5c518]/25',
    HIGH:   'text-[#ff3355] bg-[#ff3355]/10 border-[#ff3355]/25',
  };
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md border', map[effective])}>
      {level === 'AUTO' ? `AUTO → ${effective}` : effective}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function Live({ botState, onStopBot, onPositionClose, onBotStateUpdate, claudeApiKey, onGoStart }: LiveProps) {
  const [countdown, setCountdown]     = useState('');
  const [claudeThinking, setThinking] = useState(false);
  const [claudeDecision, setDecision] = useState<ClaudeDecision | null>(null);
  const [snapshot, setSnapshot]       = useState<MarketSnapshot | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError]     = useState<string | null>(null);

  const cycleTimer  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const priceTimer  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const snapshotRef = useRef<MarketSnapshot | null>(null);
  snapshotRef.current = snapshot;

  const { status, config, currentPosition, effectiveAggression } = botState;

  // ── Bot-end countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!botState.endsAt) return;
    const tick = () => setCountdown(formatCountdown(botState.endsAt!));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [botState.endsAt]);

  // ── Simulated price drift + SL/TP check ─────────────────────────────────────
  useEffect(() => {
    if (status !== 'RUNNING' || !currentPosition) { clearInterval(priceTimer.current); return; }
    priceTimer.current = setInterval(() => {
      onBotStateUpdate(prev => {
        if (!prev.currentPosition) return prev;
        const pos   = prev.currentPosition;
        const drift = (Math.random() - 0.48) * pos.entryPrice * 0.0012;
        const newP  = Math.max(pos.entryPrice * 0.5, pos.currentPrice + drift);
        const hitSL = pos.side === 'LONG' ? newP <= pos.sl  : newP >= pos.sl;
        const hitTP = pos.side === 'LONG' ? newP >= pos.tp  : newP <= pos.tp;

        if (hitSL || hitTP) {
          const aggrCfg    = AGGRESSION_CONFIGS[effectiveAggression];
          const closePrice = hitTP ? pos.tp : pos.sl;
          const pnl        = hitTP ?  pos.margin * aggrCfg.tp / 100 : -(pos.margin * aggrCfg.sl / 100);
          const trade: ClosedTrade = {
            id: 'tr_' + Date.now(), pair: prev.config?.pair ?? '',
            exchange: prev.config?.exchange ?? 'binance', side: pos.side,
            entryPrice: pos.entryPrice, closePrice, leverage: pos.leverage,
            pnl, pnlPercent: hitTP ? aggrCfg.tp : -aggrCfg.sl,
            openedAt: pos.openedAt, closedAt: new Date().toISOString(),
            closeReason: hitTP ? 'TP' : 'SL', aggressionLevel: prev.config?.aggression ?? 'MEDIUM',
            claudeAnalysis: pos.claudeReason,
          };
          onPositionClose(trade);
          return { ...prev, currentPosition: null };
        }
        const pnlRaw = pos.side === 'LONG'
          ? (newP - pos.entryPrice) / pos.entryPrice * pos.margin * pos.leverage
          : (pos.entryPrice - newP) / pos.entryPrice * pos.margin * pos.leverage;
        const pnlPct = pos.side === 'LONG'
          ? (newP - pos.entryPrice) / pos.entryPrice * 100 * pos.leverage
          : (pos.entryPrice - newP) / pos.entryPrice * 100 * pos.leverage;
        return { ...prev, currentPosition: { ...pos, currentPrice: newP, pnl: pnlRaw, pnlPercent: pnlPct } };
      });
    }, 2000);
    return () => clearInterval(priceTimer.current);
  }, [status, currentPosition?.id, effectiveAggression, onBotStateUpdate, onPositionClose]);

  // ── Main cycle: fetch OI+CVD → ask Claude ────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (status !== 'RUNNING' || !config) return;

    // 1. Fetch market data
    setDataLoading(true);
    let snap: MarketSnapshot;
    try {
      snap = await fetchMarketSnapshot(config.pair);
      setSnapshot(snap);
      setDataError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setDataError(`Błąd pobierania danych: ${msg}`);
      snap = snapshotRef.current ?? getMockSnapshot(config.pair);
      if (!snapshotRef.current) setSnapshot(snap);
    } finally {
      setDataLoading(false);
    }

    // 2. Ask Claude
    if (claudeThinking) return;
    setThinking(true);
    try {
      const decision = await askClaudeWithSnapshot(snap, claudeApiKey, config.aggression);
      setDecision(decision);

      const effAgg = computeEffectiveAggression(
        config.aggression,
        Math.abs(snap.oiChangePct) / 5,
        snap.volume24h / 10_000_000,
      );

      if ((decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') && !currentPosition) {
        const side    = decision.action === 'OPEN_LONG' ? 'LONG' : 'SHORT';
        const aggrCfg = AGGRESSION_CONFIGS[effAgg];
        const entry   = snap.price;
        const { sl, tp } = calculateSLTP(side, entry, aggrCfg);
        onBotStateUpdate(prev => ({
          ...prev,
          effectiveAggression: effAgg,
          lastClaudeCheck: new Date().toISOString(),
          currentPosition: {
            id: 'pos_' + Date.now(), side,
            entryPrice: entry, currentPrice: entry,
            leverage: aggrCfg.leverage, sl, tp,
            slPercent: aggrCfg.sl, tpPercent: aggrCfg.tp,
            pnl: 0, pnlPercent: 0, margin: 100,
            openedAt: new Date().toISOString(),
            claudeReason: decision.reasoning,
          },
        }));
      } else if (decision.action === 'CLOSE' && currentPosition) {
        const trade: ClosedTrade = {
          id: 'tr_' + Date.now(), pair: config.pair, exchange: config.exchange,
          side: currentPosition.side, entryPrice: currentPosition.entryPrice,
          closePrice: currentPosition.currentPrice, leverage: currentPosition.leverage,
          pnl: currentPosition.pnl, pnlPercent: currentPosition.pnlPercent,
          openedAt: currentPosition.openedAt, closedAt: new Date().toISOString(),
          closeReason: 'CLAUDE', aggressionLevel: config.aggression,
          claudeAnalysis: decision.reasoning,
        };
        onPositionClose(trade);
        onBotStateUpdate(prev => ({ ...prev, currentPosition: null, effectiveAggression: effAgg, lastClaudeCheck: new Date().toISOString() }));
      } else {
        onBotStateUpdate(prev => ({ ...prev, effectiveAggression: effAgg, lastClaudeCheck: new Date().toISOString() }));
      }
    } finally {
      setThinking(false);
    }
  }, [status, config, currentPosition, claudeApiKey, claudeThinking, effectiveAggression, onBotStateUpdate, onPositionClose]);

  // Start cycle on run; restart when runCycle ref changes (position changes)
  useEffect(() => {
    if (status !== 'RUNNING') return;
    const t = setTimeout(runCycle, 2000);
    cycleTimer.current = setInterval(runCycle, 30_000);
    return () => { clearTimeout(t); clearInterval(cycleTimer.current); };
  }, [status, runCycle]);

  // ── IDLE / STOPPED state ─────────────────────────────────────────────────────
  if (status === 'IDLE' || status === 'STOPPED' || !config) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-5 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)] flex items-center justify-center">
          <TrendingUp size={32} className="text-[#1a3050]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Bot nieaktywny</h2>
          <p className="text-sm text-[#8892a4] mt-1">Uruchom bota w zakładce Start aby zobaczyć wykres, dane OI+CVD i pozycje</p>
        </div>
        <button
          onClick={onGoStart}
          className="flex items-center gap-2 text-sm text-[#00d4ff] hover:text-[#67e8f9] bg-[#00d4ff]/10 border border-[#00d4ff]/25 px-5 py-2.5 rounded-xl transition-colors"
        >
          Przejdź do Start <ChevronRight size={15} />
        </button>
      </div>
    );
  }

  // ── RUNNING state ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full h-full">

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 lg:px-6 h-12 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a] shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#00d68f] animate-pulse shrink-0" />
        <span className="text-sm font-bold text-white">{config.pair}</span>
        <span className="text-[#1a3050]">·</span>
        <span className="text-xs text-[#8892a4] uppercase">{config.exchange}</span>
        <div className="ml-auto flex items-center gap-2">
          <AggrBadge level={config.aggression} effective={effectiveAggression} />
          {botState.endsAt && (
            <span className="text-xs font-mono text-[#f5c518] tabular-nums">{countdown}</span>
          )}
          <button
            onClick={onStopBot}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355] hover:bg-[#ff3355]/20 transition-colors text-xs font-medium"
          >
            <Square size={10} /> Stop
          </button>
        </div>
      </div>

      {/* TradingView Chart */}
      <div className="flex-1 min-h-0" style={{ minHeight: '240px' }}>
        <TVChart pair={config.pair} exchangeId={config.exchange} />
      </div>

      {/* OI + CVD metrics strip */}
      <OICVDStrip snapshot={snapshot} loading={dataLoading} />

      {/* Data source + timestamp */}
      <DataSourceBadge snapshot={snapshot} loading={dataLoading} error={dataError} />

      {/* Claude decision banner */}
      <ClaudeDecisionBanner decision={claudeDecision} thinking={claudeThinking} />

      {/* Position / waiting panel */}
      <div className="shrink-0 border-t border-[rgba(0,212,255,0.15)] bg-[#070c1a]">
        {currentPosition ? (
          <div className={cn(
            'mx-4 lg:mx-6 my-3 rounded-2xl border p-4',
            currentPosition.pnl >= 0 ? 'bg-[#00d68f]/6 border-[#00d68f]/20' : 'bg-[#ff3355]/6 border-[#ff3355]/20'
          )}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {currentPosition.side === 'LONG'
                  ? <ArrowUpRight size={18} className="text-[#00d68f]" />
                  : <ArrowDownRight size={18} className="text-[#ff3355]" />
                }
                <span className={cn('text-base font-bold', currentPosition.side === 'LONG' ? 'text-[#00d68f]' : 'text-[#ff3355]')}>
                  {currentPosition.side}
                </span>
                <span className="text-sm text-[#8892a4]">{currentPosition.leverage}×</span>
                <span className="text-xs text-[#8892a4]">· ${currentPosition.margin} margin</span>
              </div>
              <div className="text-right">
                <div className={cn('text-xl font-bold tabular-nums', pnlColor(currentPosition.pnl))}>{formatPnl(currentPosition.pnl)}</div>
                <div className={cn('text-sm', pnlColor(currentPosition.pnlPercent))}>{formatPercent(currentPosition.pnlPercent)}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ['Wejście', formatPrice(currentPosition.entryPrice)],
                ['Aktualny', formatPrice(currentPosition.currentPrice)],
                ['Otwarty', timeAgo(currentPosition.openedAt)],
              ].map(([l, v]) => (
                <div key={l} className="bg-[#0a0f1e]/60 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-[#8892a4] mb-1">{l}</div>
                  <div className="text-xs font-mono text-[#a0b0cc] font-semibold">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#ff3355]/8 border border-[#ff3355]/20 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-[#ff3355]/70 mb-1">Stop Loss</div>
                <div className="text-sm font-mono font-bold text-[#ff3355]">{formatPrice(currentPosition.sl)}</div>
                <div className="text-[10px] text-[#ff3355]/60">−{currentPosition.slPercent}%</div>
              </div>
              <div className="bg-[#00d68f]/8 border border-[#00d68f]/20 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-[#00d68f]/70 mb-1">Take Profit</div>
                <div className="text-sm font-mono font-bold text-[#00d68f]">{formatPrice(currentPosition.tp)}</div>
                <div className="text-[10px] text-[#00d68f]/60">+{currentPosition.tpPercent}%</div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#0a0f1e]/60">
              <BrainCircuit size={12} className="text-[#00d4ff] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#8892a4] italic leading-relaxed line-clamp-2">
                {currentPosition.claudeReason}
              </p>
            </div>
          </div>
        ) : (
          /* No active position */
          <div className="flex items-center gap-4 px-4 lg:px-6 py-4">
            <div className="w-10 h-10 rounded-xl bg-[#0d2040] flex items-center justify-center shrink-0">
              {snapshot ? (
                snapshot.oiTrend === 'rising'
                  ? <TrendingUp  size={16} className="text-[#00d68f]" />
                  : snapshot.oiTrend === 'falling'
                  ? <TrendingDown size={16} className="text-[#ff3355]" />
                  : <Zap size={16} className="text-[#8892a4]" />
              ) : (
                <TrendingUp size={16} className="text-[#8892a4]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#8892a4]">Oczekiwanie na sygnał</p>
              {botState.lastClaudeCheck && (
                <p className="text-xs text-[#8892a4] mt-0.5">
                  Ostatni check: {timeAgo(botState.lastClaudeCheck)} · następny za ~{30}s
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
