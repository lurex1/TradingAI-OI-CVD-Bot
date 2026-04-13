import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (price >= 100)   return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)     return price.toFixed(4);
  return price.toFixed(6);
}

export function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${pnl.toFixed(2)} USDT`;
}

export function formatPercent(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

export function pnlColor(v: number): string {
  if (v > 0) return 'text-[#00d68f]';
  if (v < 0) return 'text-[#ff3355]';
  return 'text-[#6b7a99]';
}

export function pnlBg(v: number): string {
  if (v > 0) return 'bg-[#00d68f]/10 border-[#00d68f]/20';
  if (v < 0) return 'bg-[#ff3355]/10 border-[#ff3355]/20';
  return 'bg-[#6b7a99]/10 border-[#6b7a99]/20';
}

export function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

export function tvSymbol(pair: string, exchangeId: string): string {
  const clean = pair.replace('/', '').toUpperCase();
  const prefix: Record<string, string> = {
    binance: 'BINANCE',
    bybit: 'BYBIT',
    okx: 'OKX',
    mexc: 'MEXC',
    kraken: 'KRAKEN',
  };
  return `${prefix[exchangeId] ?? 'BINANCE'}:${clean}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'właśnie teraz';
  if (m < 60) return `${m}m temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h temu`;
  return `${Math.floor(h / 24)}d temu`;
}

export const EXCHANGE_COLORS: Record<string, string> = {
  mexc:         '#00b4d8',
  binance:      '#f0b90b',
  bybit:        '#f7931a',
  okx:          '#3b82f6',
  kraken:       '#5741d9',
  metamask:     '#e2761b',
  walletconnect:'#3b99fc',
};
