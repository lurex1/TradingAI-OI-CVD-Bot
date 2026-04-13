import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav, type View } from './components/layout/BottomNav';
import { Start } from './views/Start';
import { Live } from './views/Live';
import { History } from './views/History';
import { Exchanges } from './views/Exchanges';
import { Fomo } from './views/Fomo';
import { defaultExchanges, mockTrades } from './data/mockData';
import { computeEffectiveAggression } from './lib/aggressionConfig';
import { checkPairAvailable } from './lib/exchangePairs';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from './lib/utils';
import type { Exchange, AnyExchangeId, BotState, BotConfig, ClosedTrade } from './types';

const INITIAL_BOT: BotState = {
  status: 'IDLE',
  config: null,
  startedAt: null,
  endsAt: null,
  currentPosition: null,
  effectiveAggression: 'MEDIUM',
  lastClaudeCheck: null,
};

export default function App() {
  const [view, setView]           = useState<View>('start');
  const [exchanges, setExchanges] = useState<Exchange[]>(defaultExchanges);
  const [botState, setBotState]   = useState<BotState>(INITIAL_BOT);
  const [trades, setTrades]       = useState<ClosedTrade[]>(mockTrades);
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [fomoInitialPair, setFomoInitialPair] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'warn' | 'err' } | null>(null);

  const handleLaunchBot = useCallback((config: BotConfig) => {
    const startedAt = new Date().toISOString();
    const endsAt    = config.duration > 0
      ? new Date(Date.now() + config.duration * 60_000).toISOString()
      : null;
    setBotState({
      status: 'RUNNING',
      config,
      startedAt,
      endsAt,
      currentPosition: null,
      effectiveAggression: computeEffectiveAggression(config.aggression),
      lastClaudeCheck: null,
    });
  }, []);

  const handleStopBot = useCallback(() => {
    setBotState(prev => ({ ...INITIAL_BOT, status: 'STOPPED', config: prev.config }));
  }, []);

  const handlePositionClose = useCallback((trade: ClosedTrade) => {
    setTrades(prev => [trade, ...prev]);
  }, []);

  const handleConnect = useCallback(async (
    id: AnyExchangeId, apiKey: string, apiSecret: string, testnet: boolean
  ) => {
    await new Promise(r => setTimeout(r, 800));
    setExchanges(prev => prev.map(e =>
      e.id === id ? { ...e, connected: true, apiKey, apiSecret, testnet } : e
    ));
  }, []);

  const handleDisconnect = useCallback((id: AnyExchangeId) => {
    setExchanges(prev => prev.map(e =>
      e.id === id
        ? { ...e, connected: false, apiKey: undefined, apiSecret: undefined, walletAddress: undefined }
        : e
    ));
  }, []);

  const handleConnectDex = useCallback((id: AnyExchangeId, address: string) => {
    setExchanges(prev => prev.map(e =>
      e.id === id ? { ...e, connected: true, walletAddress: address } : e
    ));
  }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'ok' | 'warn' | 'err' = 'err') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── FOMO → Start integration ───────────────────────────────────────────────
  const handleFomoTrade = useCallback((ticker: string) => {
    const connectedCex = exchanges.find(e => e.connected && e.type === 'CEX');
    if (!connectedCex) {
      const anyConnected = exchanges.find(e => e.connected);
      showToast(
        anyConnected
          ? 'Integracja FOMO działa tylko z giełdami CEX'
          : 'Najpierw połącz giełdę w zakładce Giełdy',
        'warn'
      );
      return;
    }
    if (!checkPairAvailable(connectedCex.id, ticker)) {
      showToast(`${ticker} nie jest dostępny na ${connectedCex.name}`, 'err');
      return;
    }
    setFomoInitialPair(`${ticker}/USDT`);
    setView('start');
    showToast(`${ticker}/USDT wpisany do pola para — zweryfikuj i uruchom bota`, 'ok');
  }, [exchanges, showToast]);

  const botRunning = botState.status === 'RUNNING';

  return (
    <div className="flex min-h-screen w-full bg-[#0a0f1e] text-[#e2e8f0]">
      {/* Desktop Sidebar */}
      <Sidebar active={view} onChange={setView} botRunning={botRunning} />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top header (mobile only) */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#00d4ff]/12 border border-[#00d4ff]/25 flex items-center justify-center">
              <span className="text-[#00d4ff] text-xs font-bold">T</span>
            </div>
            <span className="text-sm font-bold text-white">TradingAI</span>
          </div>
          {botRunning && (
            <button
              onClick={() => setView('live')}
              className="flex items-center gap-1.5 text-xs text-[#00d68f] bg-[#00d68f]/10 border border-[#00d68f]/25 px-3 py-1.5 rounded-lg"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d68f] animate-pulse" />
              Bot aktywny
            </button>
          )}
        </header>

        {/* View content */}
        <div className="flex-1 overflow-auto">
          {view === 'start' && (
            <Start
              exchanges={exchanges}
              onLaunch={handleLaunchBot}
              botRunning={botRunning}
              onGoLive={() => setView('live')}
              claudeApiKey={claudeApiKey}
              onSetApiKey={setClaudeApiKey}
              initialPair={fomoInitialPair}
              onPairConsumed={() => setFomoInitialPair(null)}
            />
          )}
          {view === 'live' && (
            <Live
              botState={botState}
              onStopBot={handleStopBot}
              onPositionClose={handlePositionClose}
              onBotStateUpdate={setBotState}
              claudeApiKey={claudeApiKey}
              onGoStart={() => setView('start')}
            />
          )}
          {view === 'fomo' && (
            <Fomo
              exchanges={exchanges}
              onTrade={handleFomoTrade}
            />
          )}
          {view === 'history' && (
            <History trades={trades} />
          )}
          {view === 'exchanges' && (
            <Exchanges
              exchanges={exchanges}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onConnectDex={handleConnectDex}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav active={view} onChange={setView} botRunning={botRunning} />

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-[360px] z-[60]',
            'flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-2xl shadow-black/50',
            'animate-in slide-in-from-bottom-2 duration-200',
            toast.type === 'ok'   && 'bg-[#071a10] border-[#00d68f]/30 text-[#00d68f]',
            toast.type === 'warn' && 'bg-[#1a1500] border-[#f5c518]/30 text-[#f5c518]',
            toast.type === 'err'  && 'bg-[#1a0508] border-[#ff3355]/30 text-[#ff3355]',
          )}
        >
          {toast.type === 'ok'   && <CheckCircle2 size={16} className="shrink-0" />}
          {toast.type === 'warn' && <AlertCircle  size={16} className="shrink-0" />}
          {toast.type === 'err'  && <XCircle      size={16} className="shrink-0" />}
          <p className="text-sm font-medium leading-snug">{toast.msg}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
