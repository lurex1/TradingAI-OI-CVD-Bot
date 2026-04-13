export interface FomoCoin {
  rank:          number;
  ticker:        string;
  name:          string;
  price:         number;
  priceChange24h: number;
  marketCap:     number;
  volume24h:     number;
  sentiment:     'bullish' | 'bearish' | 'neutral';
  fomoScore:     number;
  thumb:         string;
}

// ── CoinGecko /coins/markets item ─────────────────────────────────────────────
interface CGMarketItem {
  id:                          string;
  symbol:                      string;
  name:                        string;
  image:                       string;
  current_price:               number;
  market_cap:                  number;
  total_volume:                number;
  price_change_percentage_24h: number;
}

// ── FOMO score formula ────────────────────────────────────────────────────────
// • change bonus : change24h × 0.5     (20 % → 10 pts, 50 % → 25 pts)
// • volume ratio : (vol / mcap) × 30   (capped at 40 pts)
// • mcap bonus   : (1 − mcap / maxMcap) × 20  (lower cap → more pts)
function calcFomoScore(
  change24h: number,
  volume:    number,
  marketCap: number,
  maxMarketCap: number,
): number {
  const changeBonus  = change24h * 0.5;
  const volumeRatio  = marketCap > 0 ? Math.min((volume / marketCap) * 30, 40) : 0;
  const mcapBonus    = maxMarketCap > 0 ? (1 - marketCap / maxMarketCap) * 20 : 0;
  return Math.round(changeBonus + volumeRatio + mcapBonus);
}

// ── Main fetch ────────────────────────────────────────────────────────────────
export async function fetchFomoCoins(maxMarketCap = 100_000_000): Promise<FomoCoin[]> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/coins/markets' +
    '?vs_currency=usd&order=percent_change_24h_desc' +
    '&per_page=250&page=1&sparkline=false&price_change_percentage=24h',
    { headers: { Accept: 'application/json' } },
  );

  if (res.status === 429) throw new Error('ratelimit');
  if (!res.ok)            throw new Error(`http_${res.status}`);

  const data: CGMarketItem[] = await res.json();

  const filtered = data.filter(c =>
    c.market_cap  >  0 &&
    c.market_cap  <  maxMarketCap &&
    (c.price_change_percentage_24h ?? 0) > 10 &&
    c.total_volume > 500_000,
  );

  const scored = filtered.map(c => {
    const change    = c.price_change_percentage_24h ?? 0;
    const sentiment: FomoCoin['sentiment'] =
      change > 3  ? 'bullish' :
      change < -3 ? 'bearish' : 'neutral';

    return {
      rank:          0,
      ticker:        c.symbol.toUpperCase(),
      name:          c.name,
      price:         c.current_price,
      priceChange24h: change,
      marketCap:     c.market_cap,
      volume24h:     c.total_volume,
      sentiment,
      fomoScore:     calcFomoScore(change, c.total_volume, c.market_cap, maxMarketCap),
      thumb:         c.image ?? '',
    };
  });

  scored.sort((a, b) => b.fomoScore - a.fomoScore);

  return scored.slice(0, 10).map((c, i) => ({ ...c, rank: i + 1 }));
}

// ── Mock fallback ─────────────────────────────────────────────────────────────
export const MOCK_FOMO: FomoCoin[] = [
  { rank:1,  ticker:'BONK', name:'Bonk',          price:0.0000248, priceChange24h:45.2, marketCap: 18_200_000, volume24h:9_400_000, sentiment:'bullish', fomoScore:84, thumb:'' },
  { rank:2,  ticker:'FLOKI',name:'Floki Inu',     price:0.000182,  priceChange24h:38.6, marketCap: 32_100_000, volume24h:7_100_000, sentiment:'bullish', fomoScore:76, thumb:'' },
  { rank:3,  ticker:'PEPE', name:'Pepe',          price:0.0000092, priceChange24h:33.1, marketCap: 55_400_000, volume24h:12_300_000, sentiment:'bullish', fomoScore:68, thumb:'' },
  { rank:4,  ticker:'WIF',  name:'Dogwifhat',     price:0.0214,    priceChange24h:27.9, marketCap: 21_000_000, volume24h:4_200_000, sentiment:'bullish', fomoScore:61, thumb:'' },
  { rank:5,  ticker:'MYRO', name:'Myro',          price:0.0058,    priceChange24h:24.3, marketCap: 43_800_000, volume24h:3_800_000, sentiment:'bullish', fomoScore:52, thumb:'' },
  { rank:6,  ticker:'SLERF',name:'Slerf',         price:0.0031,    priceChange24h:21.7, marketCap: 67_200_000, volume24h:5_600_000, sentiment:'bullish', fomoScore:44, thumb:'' },
  { rank:7,  ticker:'BOME', name:'Book of Meme',  price:0.00071,   priceChange24h:19.5, marketCap: 82_500_000, volume24h:8_900_000, sentiment:'bullish', fomoScore:37, thumb:'' },
  { rank:8,  ticker:'MEW',  name:'Cat in a Dogs World', price:0.0094, priceChange24h:16.8, marketCap: 91_000_000, volume24h:6_200_000, sentiment:'bullish', fomoScore:29, thumb:'' },
  { rank:9,  ticker:'PONKE',name:'Ponke',         price:0.42,      priceChange24h:14.1, marketCap: 38_400_000, volume24h:2_100_000, sentiment:'bullish', fomoScore:22, thumb:'' },
  { rank:10, ticker:'POPCAT',name:'Popcat',       price:0.28,      priceChange24h:11.3, marketCap: 76_300_000, volume24h:3_400_000, sentiment:'bullish', fomoScore:15, thumb:'' },
];
