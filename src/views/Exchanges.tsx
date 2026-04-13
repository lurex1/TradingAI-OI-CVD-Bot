import { useState } from 'react';
import { Eye, EyeOff, Check, Trash2, Wifi, WifiOff, Wallet, AlertCircle, Plus } from 'lucide-react';
import { cn, EXCHANGE_COLORS } from '../lib/utils';
import type { Exchange, AnyExchangeId } from '../types';

interface ExchangesProps {
  exchanges: Exchange[];
  onConnect: (id: AnyExchangeId, apiKey: string, apiSecret: string, testnet: boolean) => Promise<void>;
  onDisconnect: (id: AnyExchangeId) => void;
  onConnectDex: (id: AnyExchangeId, address: string) => void;
}

const CEX_INFO: Record<string, string> = {
  mexc:    'Duża liczba altcoinów i perpetual futures',
  binance: 'Największa giełda crypto, najwyższa płynność',
  bybit:   'Specjalizuje się w instrumentach pochodnych',
  okx:     'Zaawansowane opcje i DeFi integracje',
  kraken:  'Europejska giełda, wysoki poziom bezpieczeństwa',
};

function CEXCard({
  exchange,
  onConnect,
  onDisconnect,
}: {
  exchange: Exchange;
  onConnect: (id: AnyExchangeId, k: string, s: string, t: boolean) => Promise<void>;
  onDisconnect: (id: AnyExchangeId) => void;
}) {
  const [open, setOpen]           = useState(false);
  const [apiKey, setApiKey]       = useState(exchange.apiKey ?? '');
  const [apiSecret, setSecret]    = useState(exchange.apiSecret ?? '');
  const [testnet, setTestnet]     = useState(exchange.testnet ?? false);
  const [showKey, setShowKey]     = useState(false);
  const [showSec, setShowSec]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const color = EXCHANGE_COLORS[exchange.id] ?? '#0ea5e9';

  const handleConnect = async () => {
    if (!apiKey || !apiSecret) return;
    setLoading(true);
    await onConnect(exchange.id, apiKey, apiSecret, testnet);
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className={cn(
      'bg-[#0d1526] rounded-2xl border transition-all',
      open ? 'border-[rgba(0,212,255,0.28)]' : 'border-[rgba(0,212,255,0.15)]'
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: color + '18', border: `1px solid ${color}30`, color }}
        >
          {exchange.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{exchange.name}</span>
            {exchange.connected ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-[#00d68f]">
                <Wifi size={9} /> Połączony
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-[#8892a4]">
                <WifiOff size={9} /> Offline
              </span>
            )}
            {exchange.testnet && (
              <span className="text-[9px] font-semibold text-[#f5c518] bg-[#f5c518]/10 border border-[#f5c518]/20 px-1.5 py-0.5 rounded-md">
                TESTNET
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8892a4] mt-0.5 truncate">{CEX_INFO[exchange.id]}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {exchange.connected && (
            <button
              onClick={() => onDisconnect(exchange.id)}
              className="w-8 h-8 rounded-lg bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355] hover:bg-[#ff3355]/20 flex items-center justify-center transition-colors"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={() => setOpen(v => !v)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-all',
              exchange.connected
                ? 'border-[rgba(0,212,255,0.15)] text-[#8892a4] hover:border-[rgba(0,212,255,0.28)] hover:text-white'
                : 'border-[#0ea5e9]/40 text-[#00d4ff] bg-[#0ea5e9]/8 hover:bg-[#0ea5e9]/15'
            )}
          >
            <Plus size={11} />
            {exchange.connected ? 'Edytuj' : 'Połącz'}
          </button>
        </div>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="px-4 pb-4 border-t border-[rgba(0,212,255,0.15)] pt-4 space-y-3">
          {/* Warning */}
          <div className="flex gap-2.5 p-3 rounded-xl bg-[#f5c518]/5 border border-[#f5c518]/15">
            <AlertCircle size={13} className="text-[#f5c518] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#8a7030] leading-relaxed">
              Klucze API są przechowywane lokalnie w tej sesji. W środowisku produkcyjnym użyj bezpiecznego vault'u.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider mb-1.5">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Wklej API Key…"
                className="w-full h-10 rounded-xl px-3 pr-10 text-sm transition-colors"
              />
              <button onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-[#8899bb]">
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-[10px] font-semibold text-[#8892a4] uppercase tracking-wider mb-1.5">API Secret</label>
            <div className="relative">
              <input
                type={showSec ? 'text' : 'password'}
                value={apiSecret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Wklej API Secret…"
                className="w-full h-10 rounded-xl px-3 pr-10 text-sm transition-colors"
              />
              <button onClick={() => setShowSec(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892a4] hover:text-[#8899bb]">
                {showSec ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          {/* Testnet toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative w-9 h-5 shrink-0">
              <input type="checkbox" className="sr-only" checked={testnet} onChange={e => setTestnet(e.target.checked)} />
              <div className={cn('w-9 h-5 rounded-full transition-colors', testnet ? 'bg-[#f5c518]' : 'bg-[#0d2040]')} />
              <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', testnet ? 'left-4' : 'left-0.5')} />
            </div>
            <span className="text-sm text-[#8892a4]">Tryb testnet</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={!apiKey || !apiSecret || loading}
              className={cn(
                'flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
                apiKey && apiSecret && !loading
                  ? 'bg-[#0ea5e9] text-white hover:bg-[#0284c7]'
                  : 'bg-[#0d1526] text-[#8892a4] cursor-not-allowed border border-[rgba(0,212,255,0.15)]'
              )}
            >
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Check size={14} />
              }
              {exchange.connected ? 'Zaktualizuj' : 'Połącz'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-xl text-sm text-[#8892a4] bg-[#0d1526] border border-[rgba(0,212,255,0.15)] hover:text-white hover:border-[rgba(0,212,255,0.28)] transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DEXCard({
  exchange,
  onConnect,
  onDisconnect,
}: {
  exchange: Exchange;
  onConnect: (id: AnyExchangeId, addr: string) => void;
  onDisconnect: (id: AnyExchangeId) => void;
}) {
  const [open, setOpen] = useState(false);
  const color = EXCHANGE_COLORS[exchange.id] ?? '#0ea5e9';

  const connect = () => {
    const addr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    onConnect(exchange.id, addr);
    setOpen(false);
  };

  return (
    <div className="bg-[#0d1526] rounded-2xl border border-[rgba(0,212,255,0.15)] p-4">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: color + '18', border: `1px solid ${color}30` }}
        >
          <Wallet size={18} style={{ color }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{exchange.name}</span>
            {exchange.connected
              ? <span className="text-[10px] font-medium text-[#00d68f] flex items-center gap-1"><Wifi size={9} />Połączony</span>
              : <span className="text-[10px] text-[#8892a4]">DEX / Portfel</span>
            }
          </div>
          {exchange.walletAddress && (
            <p className="text-[11px] font-mono text-[#8892a4] mt-0.5">
              {exchange.walletAddress.slice(0, 10)}…{exchange.walletAddress.slice(-6)}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {exchange.connected ? (
            <button
              onClick={() => onDisconnect(exchange.id)}
              className="w-8 h-8 rounded-lg bg-[#ff3355]/10 border border-[#ff3355]/20 text-[#ff3355] hover:bg-[#ff3355]/20 flex items-center justify-center"
            >
              <Trash2 size={12} />
            </button>
          ) : (
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-[#0ea5e9]/40 text-[#00d4ff] bg-[#0ea5e9]/8 hover:bg-[#0ea5e9]/15 transition-all"
            >
              <Wallet size={11} /> Connect
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[rgba(0,212,255,0.15)] space-y-2">
          <p className="text-sm text-[#8892a4]">
            Kliknij poniżej aby połączyć portfel przez WalletConnect lub MetaMask.
          </p>
          <div className="flex gap-2">
            <button
              onClick={connect}
              className="flex-1 h-10 rounded-xl text-sm font-semibold bg-[#0ea5e9] text-white hover:bg-[#0284c7] flex items-center justify-center gap-2 transition-colors"
            >
              <Wallet size={14} /> Połącz portfel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-10 px-4 rounded-xl text-sm text-[#8892a4] bg-[#0d1526] border border-[rgba(0,212,255,0.15)] hover:text-white transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Exchanges({ exchanges, onConnect, onDisconnect, onConnectDex }: ExchangesProps) {
  const cex       = exchanges.filter(e => e.type === 'CEX');
  const dex       = exchanges.filter(e => e.type === 'DEX');
  const connected = exchanges.filter(e => e.connected).length;

  return (
    <div className="w-full min-h-full pb-20 lg:pb-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[rgba(0,212,255,0.15)] bg-[#070c1a]">
        <h1 className="text-xl font-bold text-white">Połączone giełdy</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">Dodaj klucze API aby bot mógł handlować</p>
      </div>

      <div className="px-4 py-5 max-w-2xl space-y-5">
        {/* Connection status */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#0d1526] border border-[rgba(0,212,255,0.15)]">
          <div className={cn(
            'w-3 h-3 rounded-full shrink-0',
            connected > 0 ? 'bg-[#00d68f] animate-pulse' : 'bg-[#1a3050]'
          )} />
          <div>
            <p className="text-sm font-semibold text-white">
              {connected > 0
                ? `${connected} ${connected === 1 ? 'giełda połączona' : 'giełdy połączone'}`
                : 'Brak połączeń'
              }
            </p>
            <p className="text-xs text-[#8892a4] mt-0.5">
              {connected > 0 ? 'Bot może wykonywać zlecenia' : 'Połącz przynajmniej jedną giełdę'}
            </p>
          </div>
        </div>

        {/* CEX */}
        <div>
          <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-3 px-1">
            Scentralizowane (CEX)
          </p>
          <div className="space-y-2">
            {cex.map(ex => (
              <CEXCard
                key={ex.id}
                exchange={ex}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
              />
            ))}
          </div>
        </div>

        {/* DEX */}
        <div>
          <p className="text-xs font-semibold text-[#8892a4] uppercase tracking-wider mb-3 px-1">
            Portfele / DEX
          </p>
          <div className="space-y-2">
            {dex.map(ex => (
              <DEXCard
                key={ex.id}
                exchange={ex}
                onConnect={onConnectDex}
                onDisconnect={onDisconnect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
