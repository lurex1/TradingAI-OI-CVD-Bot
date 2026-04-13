import { useState } from 'react';
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Trophy, Target, Percent, BrainCircuit
} from 'lucide-react';
import { cn, formatPrice, formatPnl, formatPercent, pnlColor, timeAgo } from '../lib/utils';
import type { ClosedTrade, AggressionLevel, CloseReason } from '../types';

interface HistoryProps {
  trades: ClosedTrade[];
}

const REASON_LABEL: Record<CloseReason, { text: string; color: string }> = {
  TP:     { text: 'Take Profit', color: 'text-[#00d68f]'  },
  SL:     { text: 'Stop Loss',   color: 'text-[#ff3355]'  },
  CLAUDE: { text: 'Claude AI',   color: 'text-[#00d4ff]'  },
  MANUAL: { text: 'Ręcznie',     color: 'text-[#f5c518]'  },
};

const AGG_STYLE: Record<AggressionLevel, string> = {
  LOW:    'text-[#00d68f] bg-[#00d68f]/10 border-[#00d68f]/20',
  MEDIUM: 'text-[#f5c518] bg-[#f5c518]/10 border-[#f5c518]/20',
  HIGH:   'text-[#ff3355] bg-[#ff3355]/10 border-[#ff3355]/20',
  AUTO:   'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/20',
};

function TradeCard({ trade }: { trade: ClosedTrade }) {
  const [open, setOpen] = useState(false);
  const isWin  = trade.pnl > 0;
  const reason = REASON_LABEL[trade.closeReason];

  return (
    <div className={cn(
      'rounded-2xl border transition-all',
      isWin ? 'border-[#00d68f]/15 bg-[#00d68f]/4' : 'border-[#ff3355]/15 bg-[#ff3355]/4'
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left p-4"
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isWin ? 'bg-[#00d68f]/12' : 'bg-[#ff3355]/12'
          )}>
            {trade.side === 'LONG'
              ? <TrendingUp size={16} className={isWin ? 'text-[#00d68f]' : 'text-[#ff3355]'} />
              : <TrendingDown size={16} className={isWin ? 'text-[#00d68f]' : 'text-[#ff3355]'} />
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-white">{trade.pair}</span>
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                trade.side === 'LONG'
                  ? 'text-[#00d68f] bg-[#00d68f]/10'
                  : 'text-[#ff3355] bg-[#ff3355]/10'
              )}>
                {trade.side}
              </span>
              <span className="text-[10px] text-[#8892a4]">{trade.leverage}×</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={reason.color}>{reason.text}</span>
              <span className="text-[#1a3050]">·</span>
              <span className="text-[#8892a4]">{timeAgo(trade.closedAt)}</span>
              <span className="text-[#1a3050]">·</span>
              <span className="text-[#8892a4] uppercase text-[10px]">{trade.exchange}</span>
            </div>
          </div>

          {/* PnL */}
          <div className="text-right shrink-0">
            <div className={cn('text-base font-bold tabular-nums', pnlColor(trade.pnl))}>
              {formatPnl(trade.pnl)}
            </div>
            <div className={cn('text-xs', pnlColor(trade.pnlPercent))}>
              {formatPercent(trade.pnlPercent)}
            </div>
          </div>

          {open
            ? <ChevronUp size={14} className="text-[#8892a4] shrink-0" />
            : <ChevronDown size={14} className="text-[#8892a4] shrink-0" />
          }
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {/* Prices */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#0a0f1e]/70 rounded-xl p-3">
              <div className="text-[10px] text-[#8892a4] mb-1">Cena wejścia</div>
              <div className="text-sm font-mono text-[#a0b0cc] font-semibold">{formatPrice(trade.entryPrice)}</div>
            </div>
            <div className="bg-[#0a0f1e]/70 rounded-xl p-3">
              <div className="text-[10px] text-[#8892a4] mb-1">Cena zamknięcia</div>
              <div className={cn('text-sm font-mono font-semibold', pnlColor(trade.pnl))}>{formatPrice(trade.closePrice)}</div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-md border', AGG_STYLE[trade.aggressionLevel])}>
              {trade.aggressionLevel}
            </span>
          </div>

          {/* Claude analysis */}
          <div className="p-3 rounded-xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)]">
            <div className="flex items-center gap-1.5 mb-2">
              <BrainCircuit size={12} className="text-[#00d4ff]" />
              <p className="text-[10px] text-[#00d4ff] font-semibold uppercase tracking-wider">Uzasadnienie Claude</p>
            </div>
            <p className="text-[12px] text-[#8899bb] leading-relaxed">{trade.claudeAnalysis}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function History({ trades }: HistoryProps) {
  const wins    = trades.filter(t => t.pnl > 0).length;
  const total   = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  return (
    <div className="w-full min-h-full pb-20 lg:pb-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a]">
        <h1 className="text-xl font-bold text-white">Historia transakcji</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">Zamknięte pozycje z analizą Claude</p>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0d1526] border border-[rgba(0,212,255,0.15)] rounded-2xl p-4 text-center">
            <Trophy size={16} className="text-[#f5c518] mx-auto mb-2" />
            <div className="text-xl font-bold text-white">{wins}<span className="text-[#8892a4] text-sm font-normal">/{trades.length}</span></div>
            <div className="text-xs text-[#8892a4] mt-1">Wygrane</div>
          </div>
          <div className="bg-[#0d1526] border border-[rgba(0,212,255,0.15)] rounded-2xl p-4 text-center">
            <Percent size={16} className="text-[#00d4ff] mx-auto mb-2" />
            <div className={cn('text-xl font-bold', winRate >= 50 ? 'text-[#00d68f]' : 'text-[#ff3355]')}>
              {winRate.toFixed(0)}%
            </div>
            <div className="text-xs text-[#8892a4] mt-1">Win Rate</div>
          </div>
          <div className="bg-[#0d1526] border border-[rgba(0,212,255,0.15)] rounded-2xl p-4 text-center">
            <Target size={16} className={cn('mx-auto mb-2', total >= 0 ? 'text-[#00d68f]' : 'text-[#ff3355]')} />
            <div className={cn('text-xl font-bold tabular-nums', pnlColor(total))}>
              {total >= 0 ? '+' : ''}{total.toFixed(0)}
            </div>
            <div className="text-xs text-[#8892a4] mt-1">USDT</div>
          </div>
        </div>

        {/* Trade list */}
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)] flex items-center justify-center">
              <TrendingUp size={24} className="text-[#1a3050]" />
            </div>
            <p className="text-base font-semibold text-[#8892a4]">Brak zamkniętych transakcji</p>
            <p className="text-sm text-[#8892a4]">Uruchom bota aby zobaczyć historię</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(t => <TradeCard key={t.id} trade={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
