import { useEffect, useRef, useState, useCallback } from 'react';
import {
  TrendingUp, Square, Zap,
  ArrowUpRight, ArrowDownRight, ChevronRight, BrainCircuit
} from 'lucide-react';
import { cn, formatPrice, formatPnl, formatPercent, formatCountdown, tvSymbol, pnlColor, timeAgo } from '../lib/utils';
import { AGGRESSION_CONFIGS, computeEffectiveAggression, calculateSLTP } from '../lib/aggressionConfig';
import { askClaude } from '../lib/claudeService';
import type { BotState, ClosedTrade, WebhookSignal, AggressionLevel } from '../types';

declare global {
  interface Window {
    TradingView: { widget: new (cfg: Record<string, unknown>) => void };
  }
}

interface LiveProps {
  botState: BotState;
  onStopBot: () => void;
  onPositionClose: (trade: ClosedTrade) => void;
  onBotStateUpdate: (updater: (prev: BotState) => BotState) => void;
  claudeApiKey: string;
  onGoStart: () => void;
}

// ─── TradingView chart ────────────────────────────────────────────────────────
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
        interval:            '15',
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
        enabled_features:    [],
      });
    };

    if (window.TradingView) { init(); return; }

    let script = document.getElementById('tv-script') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id  = 'tv-script';
      script.src = 'https://s3.tradingview.com/tv.js';
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

// ─── Aggression badge ─────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export function Live({ botState, onStopBot, onPositionClose, onBotStateUpdate, claudeApiKey, onGoStart }: LiveProps) {
  const [countdown, setCountdown]     = useState('');
  const [claudeThinking, setThinking] = useState(false);
  const [lastDecision, setLast]       = useState<{ text: string; time: string } | null>(null);

  const claudeTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const priceTimer  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const { status, config, currentPosition, effectiveAggression } = botState;

  // Countdown
  useEffect(() => {
    if (!botState.endsAt) return;
    const tick = () => setCountdown(formatCountdown(botState.endsAt!));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [botState.endsAt]);

  // Simulated price drift + SL/TP check
  useEffect(() => {
    if (status !== 'RUNNING' || !currentPosition) {
      clearInterval(priceTimer.current);
      return;
    }
    priceTimer.current = setInterval(() => {
      onBotStateUpdate(prev => {
        if (!prev.currentPosition) return prev;
        const pos = prev.currentPosition;
        const drift    = (Math.random() - 0.48) * pos.entryPrice * 0.0012;
        const newPrice = Math.max(pos.entryPrice * 0.5, pos.currentPrice + drift);

        const hitSL = pos.side === 'LONG' ? newPrice <= pos.sl : newPrice >= pos.sl;
        const hitTP = pos.side === 'LONG' ? newPrice >= pos.tp : newPrice <= pos.tp;

        if (hitSL || hitTP) {
          const aggrCfg = AGGRESSION_CONFIGS[effectiveAggression];
          const closePrice = hitTP ? pos.tp : pos.sl;
          const pnl = hitTP
            ? pos.margin * aggrCfg.tp / 100
            : -(pos.margin * aggrCfg.sl / 100);
          const pnlPct = hitTP ? aggrCfg.tp : -aggrCfg.sl;
          const trade: ClosedTrade = {
            id:             'tr_' + Date.now(),
            pair:           prev.config?.pair ?? '',
            exchange:       prev.config?.exchange ?? 'binance',
            side:           pos.side,
            entryPrice:     pos.entryPrice,
            closePrice,
            leverage:       pos.leverage,
            pnl,
            pnlPercent:     pnlPct,
            openedAt:       pos.openedAt,
            closedAt:       new Date().toISOString(),
            closeReason:    hitTP ? 'TP' : 'SL',
            aggressionLevel: prev.config?.aggression ?? 'MEDIUM',
            claudeAnalysis: pos.claudeReason,
          };
          onPositionClose(trade);
          return { ...prev, currentPosition: null };
        }

        const pnlRaw = pos.side === 'LONG'
          ? (newPrice - pos.entryPrice) / pos.entryPrice * pos.margin * pos.leverage
          : (pos.entryPrice - newPrice) / pos.entryPrice * pos.margin * pos.leverage;
        const pnlPct = pos.side === 'LONG'
          ? (newPrice - pos.entryPrice) / pos.entryPrice * 100 * pos.leverage
          : (pos.entryPrice - newPrice) / pos.entryPrice * 100 * pos.leverage;

        return {
          ...prev,
          currentPosition: { ...pos, currentPrice: newPrice, pnl: pnlRaw, pnlPercent: pnlPct },
        };
      });
    }, 2000);
    return () => clearInterval(priceTimer.current);
  }, [status, currentPosition?.id, effectiveAggression, onBotStateUpdate, onPositionClose]);

  // Claude analysis loop
  const runClaude = useCallback(async () => {
    if (claudeThinking || status !== 'RUNNING') return;
    setThinking(true);

    const signal: WebhookSignal = {
      pair:      config?.pair ?? 'SOL/USDT',
      action:    'LONG',
      price:     currentPosition?.currentPrice ?? 140 + Math.random() * 20,
      oi:        (Math.random() - 0.5) * 600_000,
      cvd:       (Math.random() - 0.5) * 800_000,
      volume:    1_000_000 + Math.random() * 1_000_000,
      timestamp: new Date().toISOString(),
    };

    const decision = await askClaude(signal, claudeApiKey, config?.aggression ?? 'MEDIUM');
    setLast({ text: decision.reasoning.slice(0, 120) + (decision.reasoning.length > 120 ? '…' : ''), time: new Date().toISOString() });

    const effAgg = computeEffectiveAggression(
      config?.aggression ?? 'MEDIUM',
      Math.abs(signal.oi) / 50_000,
      signal.volume / 1_000_000
    );

    if ((decision.action === 'OPEN_LONG' || decision.action === 'OPEN_SHORT') && !currentPosition) {
      const side    = decision.action === 'OPEN_LONG' ? 'LONG' : 'SHORT';
      const aggrCfg = AGGRESSION_CONFIGS[effAgg];
      const entry   = signal.price;
      const { sl, tp } = calculateSLTP(side, entry, aggrCfg);
      onBotStateUpdate(prev => ({
        ...prev,
        effectiveAggression: effAgg,
        lastClaudeCheck: new Date().toISOString(),
        currentPosition: {
          id:            'pos_' + Date.now(),
          side,
          entryPrice:    entry,
          currentPrice:  entry,
          leverage:      aggrCfg.leverage,
          sl, tp,
          slPercent:     aggrCfg.sl,
          tpPercent:     aggrCfg.tp,
          pnl:           0,
          pnlPercent:    0,
          margin:        100,
          openedAt:      new Date().toISOString(),
          claudeReason:  decision.reasoning,
        },
      }));
    } else if (decision.action === 'CLOSE' && currentPosition) {
      const trade: ClosedTrade = {
        id:             'tr_' + Date.now(),
        pair:           config?.pair ?? '',
        exchange:       config?.exchange ?? 'binance',
        side:           currentPosition.side,
        entryPrice:     currentPosition.entryPrice,
        closePrice:     currentPosition.currentPrice,
        leverage:       currentPosition.leverage,
        pnl:            currentPosition.pnl,
        pnlPercent:     currentPosition.pnlPercent,
        openedAt:       currentPosition.openedAt,
        closedAt:       new Date().toISOString(),
        closeReason:    'CLAUDE',
        aggressionLevel: config?.aggression ?? 'MEDIUM',
        claudeAnalysis: decision.reasoning,
      };
      onPositionClose(trade);
      onBotStateUpdate(prev => ({ ...prev, currentPosition: null, effectiveAggression: effAgg, lastClaudeCheck: new Date().toISOString() }));
    } else {
      onBotStateUpdate(prev => ({ ...prev, effectiveAggression: effAgg, lastClaudeCheck: new Date().toISOString() }));
    }

    setThinking(false);
  }, [claudeThinking, status, config, currentPosition, claudeApiKey, onBotStateUpdate, onPositionClose, effectiveAggression]);

  useEffect(() => {
    if (status !== 'RUNNING') return;
    const t = setTimeout(runClaude, 3000);
    claudeTimer.current = setInterval(runClaude, 30_000);
    return () => { clearTimeout(t); clearInterval(claudeTimer.current); };
  }, [status, runClaude]);

  // ── IDLE state ──────────────────────────────────────────────────────────────
  if (status === 'IDLE' || status === 'STOPPED' || !config) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-5 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)] flex items-center justify-center">
          <TrendingUp size={32} className="text-[#1a3050]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Bot nieaktywny</h2>
          <p className="text-sm text-[#8892a4] mt-1">Uruchom bota w zakładce Start aby zobaczyć wykres i pozycje</p>
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

  // ── RUNNING state ───────────────────────────────────────────────────────────
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
            title="Zatrzymaj bota"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355] hover:bg-[#ff3355]/20 transition-colors text-xs font-medium"
          >
            <Square size={10} /> Stop
          </button>
        </div>
      </div>

      {/* Chart — grows to fill available space */}
      <div className="flex-1 min-h-0" style={{ minHeight: '380px' }}>
        <TVChart pair={config.pair} exchangeId={config.exchange} />
      </div>

      {/* Pine script note */}
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2 bg-[#070c1a] border-t border-[rgba(0,212,255,0.15)] shrink-0">
        <Zap size={11} className="text-[#f5c518] shrink-0" />
        <p className="text-[10px] text-[#8892a4]">
          Dodaj wskaźnik <span className="text-[#a0b0cc] font-medium">MEGA OI + CVD</span> do wykresu TradingView (Pine Script dostępny w projekcie)
        </p>
      </div>

      {/* Bottom panel: position or waiting */}
      <div className="shrink-0 border-t border-[rgba(0,212,255,0.15)] bg-[#070c1a]">
        {currentPosition ? (
          /* Active position card */
          <div className={cn(
            'mx-4 lg:mx-6 my-4 rounded-2xl border p-4',
            currentPosition.pnl >= 0
              ? 'bg-[#00d68f]/6 border-[#00d68f]/20'
              : 'bg-[#ff3355]/6 border-[#ff3355]/20'
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
                <div className={cn('text-xl font-bold tabular-nums', pnlColor(currentPosition.pnl))}>
                  {formatPnl(currentPosition.pnl)}
                </div>
                <div className={cn('text-sm', pnlColor(currentPosition.pnlPercent))}>
                  {formatPercent(currentPosition.pnlPercent)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#0a0f1e]/60 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-[#8892a4] mb-1">Wejście</div>
                <div className="text-xs font-mono text-[#a0b0cc]">{formatPrice(currentPosition.entryPrice)}</div>
              </div>
              <div className="bg-[#0a0f1e]/60 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-[#8892a4] mb-1">Aktualny</div>
                <div className="text-xs font-mono text-white font-semibold">{formatPrice(currentPosition.currentPrice)}</div>
              </div>
              <div className="bg-[#0a0f1e]/60 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-[#8892a4] mb-1">Otwarty</div>
                <div className="text-xs text-[#a0b0cc]">{timeAgo(currentPosition.openedAt)}</div>
              </div>
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
          /* Waiting / Claude thinking */
          <div className="flex items-center gap-4 px-4 lg:px-6 py-4">
            {claudeThinking ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-[#f5c518]/10 border border-[#f5c518]/20 flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 border-2 border-[#f5c518]/40 border-t-[#f5c518] rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#f5c518]">Claude analizuje rynek…</p>
                  <p className="text-xs text-[#8892a4] mt-0.5">Sprawdza OI, CVD i trend</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-[#0d2040] flex items-center justify-center shrink-0">
                  <TrendingUp size={16} className="text-[#8892a4]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#8892a4]">Oczekiwanie na sygnał</p>
                  {botState.lastClaudeCheck && (
                    <p className="text-xs text-[#8892a4] mt-0.5">
                      Ostatni check: {timeAgo(botState.lastClaudeCheck)}
                    </p>
                  )}
                </div>
                {lastDecision && (
                  <div className="ml-auto max-w-xs hidden sm:block">
                    <p className="text-[10px] text-[#00d4ff] mb-0.5">Ostatnia decyzja</p>
                    <p className="text-[11px] text-[#8892a4] italic line-clamp-1">{lastDecision.text}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Last decision below position (mobile) */}
        {lastDecision && !claudeThinking && currentPosition && (
          <div className="sm:hidden px-4 pb-3">
            <div className="p-2.5 rounded-xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)]">
              <p className="text-[10px] text-[#00d4ff] mb-1">Ostatnia decyzja Claude</p>
              <p className="text-[11px] text-[#8892a4] italic line-clamp-2">{lastDecision.text}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
