import { useState, useEffect, useRef } from 'react';
import {
  Search, CheckCircle2, XCircle, AlertCircle, Rocket,
  Clock, Zap, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { Exchange, BotConfig, AggressionLevel, AnyExchangeId } from '../types';
import { AGGRESSION_CONFIGS } from '../lib/aggressionConfig';

interface StartProps {
  exchanges: Exchange[];
  onLaunch: (config: BotConfig) => void;
  botRunning: boolean;
  onGoLive: () => void;
  claudeApiKey: string;
  onSetApiKey: (k: string) => void;
  initialPair?: string | null;
  onPairConsumed?: () => void;
}

const DURATIONS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h',  minutes: 60 },
  { label: '2h',  minutes: 120 },
  { label: '4h',  minutes: 240 },
  { label: '8h',  minutes: 480 },
  { label: '24h', minutes: 1440 },
  { label: '∞',   minutes: 0 },
];

const AGGRESSION_META: Record<AggressionLevel, { title: string; desc: string; color: string }> = {
  LOW:    { title: 'Niski',  desc: 'SL 2% / TP 4% / 3×',   color: '#00d68f' },
  MEDIUM: { title: 'Średni', desc: 'SL 3% / TP 6% / 5×',   color: '#f5c518' },
  HIGH:   { title: 'Wysoki', desc: 'SL 5% / TP 10% / 10×', color: '#ff3355' },
  AUTO:   { title: 'Auto',   desc: 'Dynamiczny wg rynku',   color: '#00d4ff' },
};

type VerifyStatus = 'idle' | 'checking' | 'ok' | 'fail';

export function Start({ exchanges, onLaunch, botRunning, onGoLive, claudeApiKey, onSetApiKey, initialPair, onPairConsumed }: StartProps) {
  const [pair, setPair]             = useState('');
  const [selectedEx, setSelectedEx] = useState<AnyExchangeId | ''>('');
  const [duration, setDuration]     = useState(60);
  const [aggression, setAggression] = useState<AggressionLevel>('MEDIUM');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showExDrop, setShowExDrop] = useState(false);
  const pairRef = useRef<HTMLInputElement>(null);

  const connectedExchanges = exchanges.filter(e => e.connected);
  const selectedExchange   = exchanges.find(e => e.id === selectedEx);

  // Auto-fill pair from FOMO integration
  useEffect(() => {
    if (initialPair) {
      setPair(initialPair);
      setVerifyStatus('idle');
      onPairConsumed?.();
      setTimeout(() => pairRef.current?.focus(), 100);
    }
  }, [initialPair, onPairConsumed]);

  useEffect(() => { setVerifyStatus('idle'); }, [pair, selectedEx]);

  const handleVerify = async () => {
    if (!pair || !selectedEx) return;
    setVerifyStatus('checking');
    await new Promise(r => setTimeout(r, 1000));
    const norm  = pair.toUpperCase().replace(/\s+/g, '');
    const clean = norm.includes('/') ? norm : norm + '/USDT';
    const valid = /^[A-Z]{2,12}\/[A-Z]{2,6}$/.test(clean);
    setVerifyStatus(valid ? 'ok' : 'fail');
  };

  const normalizedPair = (() => {
    const n = pair.toUpperCase().replace(/\s+/g, '');
    return n.includes('/') ? n : n + '/USDT';
  })();

  const cfg      = aggression !== 'AUTO' ? AGGRESSION_CONFIGS[aggression] : null;
  const canLaunch = verifyStatus === 'ok' && !!selectedEx && !botRunning;

  return (
    <div className="w-full min-h-full pb-20 lg:pb-6">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a]">
        <h1 className="text-xl font-bold text-white">Uruchom bota</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">Wybierz parę, giełdę i parametry ryzyka</p>
      </div>

      <div className="px-4 py-5 max-w-2xl space-y-4">
        {/* Active bot banner */}
        {botRunning && (
          <div
            onClick={onGoLive}
            className="flex items-center gap-3 p-4 rounded-xl bg-[#00d68f]/8 border border-[#00d68f]/25 cursor-pointer hover:bg-[#00d68f]/12 transition-colors"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#00d68f] animate-pulse shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#00d68f]">Bot jest aktywny</p>
              <p className="text-xs text-[#00d68f]/60 mt-0.5">Kliknij aby przejść do widoku Live →</p>
            </div>
          </div>
        )}

        {/* ── Para ── */}
        <section className="section-card">
          <label className="field-label">
            Para handlowa
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8892a4] pointer-events-none" />
              <input
                ref={pairRef}
                type="text"
                value={pair}
                onChange={e => setPair(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerify()}
                placeholder="np. SOL/USDT, BTC/USDT…"
                className="w-full h-11 rounded-xl pl-9 pr-4 text-sm transition-colors"
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={!pair || !selectedEx || verifyStatus === 'checking'}
              className={cn(
                'h-11 px-4 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shrink-0',
                verifyStatus === 'ok'
                  ? 'bg-[#00d68f]/15 border border-[#00d68f]/30 text-[#00d68f]'
                  : verifyStatus === 'fail'
                    ? 'bg-[#ff3355]/15 border border-[#ff3355]/30 text-[#ff3355]'
                    : (!pair || !selectedEx)
                      ? 'bg-[#0d1526] border border-[rgba(0,212,255,0.15)] text-[#8892a4] cursor-not-allowed'
                      : 'bg-[#0d1526] border border-[rgba(0,212,255,0.28)] text-[#a0b0cc] hover:border-[#0ea5e9] hover:text-white'
              )}
            >
              {verifyStatus === 'checking' ? (
                <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
              ) : verifyStatus === 'ok' ? (
                <CheckCircle2 size={15} />
              ) : verifyStatus === 'fail' ? (
                <XCircle size={15} />
              ) : null}
              {verifyStatus === 'checking' ? 'Weryfikuję…'
                : verifyStatus === 'ok'    ? 'OK'
                : verifyStatus === 'fail'  ? 'Niedostępna'
                : 'Weryfikuj'}
            </button>
          </div>
          {verifyStatus === 'fail' && (
            <p className="text-xs text-[#ff3355] mt-1.5 flex items-center gap-1">
              <XCircle size={11} /> Para niedostępna na tej giełdzie
            </p>
          )}
        </section>

        {/* ── Giełda ── */}
        <section className="section-card">
          <label className="field-label">
            Giełda
          </label>
          {connectedExchanges.length === 0 ? (
            <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)]">
              <AlertCircle size={14} className="text-[#f5c518] shrink-0" />
              <span className="text-sm text-[#8892a4]">Brak połączonych giełd — przejdź do zakładki <strong className="text-[#a0b0cc]">Giełdy</strong></span>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowExDrop(v => !v)}
                className="w-full h-11 flex items-center justify-between bg-[#0d1526] border border-[rgba(0,212,255,0.15)] rounded-xl px-4 text-sm text-white focus:outline-none hover:border-[rgba(0,212,255,0.3)] transition-colors"
              >
                {selectedExchange ? (
                  <span className="flex items-center gap-2">
                    <span className="text-[#8892a4] text-xs font-mono w-5">{selectedExchange.logo}</span>
                    <span className="font-medium">{selectedExchange.name}</span>
                    <span className="text-xs text-[#8892a4] bg-[#0d1526] px-1.5 py-0.5 rounded-md">{selectedExchange.type}</span>
                  </span>
                ) : (
                  <span className="text-[#8892a4]">Wybierz połączoną giełdę…</span>
                )}
                <ChevronDown size={14} className={cn('text-[#8892a4] transition-transform', showExDrop && 'rotate-180')} />
              </button>
              {showExDrop && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-[#0d1526] border border-[rgba(0,212,255,0.15)] rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                  {connectedExchanges.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => { setSelectedEx(ex.id); setShowExDrop(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-[#0d1526] transition-colors border-b border-[rgba(0,212,255,0.15)] last:border-0"
                    >
                      <span className="text-[#8892a4] font-mono text-xs w-5">{ex.logo}</span>
                      <span className="font-medium flex-1 text-left">{ex.name}</span>
                      <span className="text-[10px] text-[#8892a4] bg-[#0d1526] px-1.5 py-0.5 rounded">{ex.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Czas działania ── */}
        <section className="section-card">
          <label className="field-label flex items-center gap-1.5">
            <Clock size={11} /> Czas działania
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {DURATIONS.map(d => (
              <button
                key={d.minutes}
                onClick={() => setDuration(d.minutes)}
                className={cn(
                  'h-10 rounded-xl text-sm font-medium transition-all',
                  duration === d.minutes
                    ? 'bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/20'
                    : 'bg-[#0d1526] border border-[rgba(0,212,255,0.15)] text-[#8892a4] hover:text-white hover:border-[rgba(0,212,255,0.28)]'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Poziom agresji ── */}
        <section className="section-card">
          <label className="field-label flex items-center gap-1.5">
            <Zap size={11} /> Poziom agresji
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(Object.keys(AGGRESSION_META) as AggressionLevel[]).map(lvl => {
              const { title, desc, color } = AGGRESSION_META[lvl];
              const isActive = aggression === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setAggression(lvl)}
                  style={isActive ? { borderColor: color + '55', backgroundColor: color + '12', color } : {}}
                  className={cn(
                    'p-3 rounded-xl text-left transition-all border',
                    isActive ? '' : 'border-[rgba(0,212,255,0.15)] bg-[#0d1526] hover:border-[rgba(0,212,255,0.28)]'
                  )}
                >
                  <div className={cn('text-sm font-bold', isActive ? '' : 'text-[#a0b0cc]')}>{title}</div>
                  <div className={cn('text-[11px] mt-0.5', isActive ? 'opacity-70' : 'text-[#8892a4]')}>{desc}</div>
                </button>
              );
            })}
          </div>

          {/* SL / TP / Dźwignia preview */}
          {cfg && (
            <div className="flex items-stretch gap-2 mt-3 p-3 rounded-xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)]">
              <div className="flex-1 text-center">
                <div className="text-[11px] text-[#8892a4] mb-1">Stop Loss</div>
                <div className="text-base font-bold text-[#ff3355]">{cfg.sl}%</div>
              </div>
              <div className="w-px bg-[rgba(0,212,255,0.15)]" />
              <div className="flex-1 text-center">
                <div className="text-[11px] text-[#8892a4] mb-1">Take Profit</div>
                <div className="text-base font-bold text-[#00d68f]">{cfg.tp}%</div>
              </div>
              <div className="w-px bg-[rgba(0,212,255,0.15)]" />
              <div className="flex-1 text-center">
                <div className="text-[11px] text-[#8892a4] mb-1">Dźwignia</div>
                <div className="text-base font-bold text-white">{cfg.leverage}×</div>
              </div>
            </div>
          )}
        </section>

        {/* ── Claude API Key ── */}
        <section className="section-card">
          <label className="field-label">
            Claude API Key
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={claudeApiKey}
              onChange={e => onSetApiKey(e.target.value)}
              placeholder="sk-ant-… (zostaw puste = tryb demo)"
              className="w-full h-11 rounded-xl px-4 pr-20 text-sm transition-colors"
            />
            <button
              onClick={() => setShowApiKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[#8892a4] hover:text-[#8899bb] transition-colors"
            >
              {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
              <span className="text-[10px] font-medium">{showApiKey ? 'UKRYJ' : 'POKAŻ'}</span>
            </button>
          </div>
          {!claudeApiKey && (
            <p className="text-[11px] text-[#8892a4] mt-1.5">
              Bez klucza API działa tryb demo z symulowanymi decyzjami Claude
            </p>
          )}
        </section>

        {/* ── Launch ── */}
        <button
          disabled={!canLaunch}
          onClick={() => {
            if (!canLaunch || !selectedEx) return;
            onLaunch({ pair: normalizedPair, exchange: selectedEx, duration, aggression });
            onGoLive();
          }}
          className={cn(
            'w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2.5 transition-all',
            canLaunch
              ? 'bg-[#0ea5e9] text-white hover:bg-[#0284c7] shadow-xl shadow-[#0ea5e9]/25'
              : 'bg-[#0d1526] border border-[rgba(0,212,255,0.15)] text-[#8892a4] cursor-not-allowed'
          )}
        >
          <Rocket size={18} />
          {botRunning ? 'Bot już działa' : 'Uruchom bota'}
        </button>

        {/* ── Webhook info ── */}
        <div className="section-card" style={{marginBottom:0}}>
          <p className="text-xs font-semibold text-[#8892a4] mb-1.5 uppercase tracking-wider">
            Webhook TradingView
          </p>
          <code className="text-[11px] text-[#8892a4] font-mono break-all block">
            POST http://localhost:5173/webhook
          </code>
          <p className="text-[11px] text-[#8892a4] mt-1.5">
            Sygnały z alertów TradingView (wskaźnik OI+CVD) trafiają tutaj automatycznie.
          </p>
        </div>
      </div>
    </div>
  );
}
