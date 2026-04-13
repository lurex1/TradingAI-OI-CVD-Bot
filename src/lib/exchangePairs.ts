// Known USDT perpetual/spot pairs per CEX exchange.
// In production these would be fetched from the exchange REST API
// (e.g. Binance GET /api/v3/exchangeInfo).
const TICKERS_BY_EXCHANGE: Record<string, Set<string>> = {
  binance: new Set([
    'BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'MATIC','UNI','LTC','ATOM','FTM','NEAR','ICP','APT','ARB','OP',
    'SUI','INJ','TIA','JUP','WIF','PEPE','BONK','SEI','PYTH','BLUR',
    'FET','GRT','SAND','MANA','AXS','GALA','ENS','LDO','RPL','AAVE',
    'FLOKI','SHIB','ORDI','SATS','1000SATS','NOT',
  ]),
  bybit: new Set([
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'MATIC','UNI','LTC','ATOM','FTM','NEAR','APT','ARB','OP',
    'SUI','INJ','TIA','WIF','PEPE','BONK','SEI','BNB','JUP',
    'FLOKI','SHIB','ORDI','NOT',
  ]),
  mexc: new Set([
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'MATIC','UNI','LTC','ATOM','FTM','NEAR','APT','ARB','OP',
    'SUI','INJ','TIA','WIF','PEPE','BONK','SEI','BNB',
    'FLOKI','SHIB','BABYDOGE','ETC','NOT','ORDI',
  ]),
  okx: new Set([
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'MATIC','UNI','LTC','ATOM','FTM','NEAR','APT','ARB','OP',
    'SUI','INJ','TIA','WIF','PEPE','BONK','BNB','ORDI',
  ]),
  kraken: new Set([
    'BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'MATIC','UNI','LTC','ATOM','FTM',
  ]),
};

/** Returns true if ticker has a USDT pair on the given exchange. */
export function checkPairAvailable(exchangeId: string, ticker: string): boolean {
  return TICKERS_BY_EXCHANGE[exchangeId]?.has(ticker.toUpperCase()) ?? false;
}
