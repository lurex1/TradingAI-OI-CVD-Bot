export interface FomoCoin {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  bullishVotes: number;
  bearishVotes: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  fomoScore: number;
}

interface CPVotes {
  negative: number;
  positive: number;
  important: number;
  liked: number;
  disliked: number;
  comments: number;
}

interface CPPost {
  currencies?: Array<{ code: string; title: string }>;
  votes: CPVotes;
}

interface CPResponse {
  results: CPPost[];
}

// ── Demo data shown when no token is provided ─────────────────────────────────
export const MOCK_FOMO_COINS: FomoCoin[] = [
  { rank: 1, ticker: 'BTC',  name: 'Bitcoin',         mentions: 47, bullishVotes: 318, bearishVotes: 42,  sentiment: 'bullish', fomoScore: 880 },
  { rank: 2, ticker: 'ETH',  name: 'Ethereum',        mentions: 34, bullishVotes: 215, bearishVotes: 51,  sentiment: 'bullish', fomoScore: 621 },
  { rank: 3, ticker: 'SOL',  name: 'Solana',          mentions: 29, bullishVotes: 194, bearishVotes: 29,  sentiment: 'bullish', fomoScore: 530 },
  { rank: 4, ticker: 'XRP',  name: 'Ripple',          mentions: 24, bullishVotes: 112, bearishVotes: 88,  sentiment: 'neutral', fomoScore: 373 },
  { rank: 5, ticker: 'DOGE', name: 'Dogecoin',        mentions: 19, bullishVotes: 98,  bearishVotes: 14,  sentiment: 'bullish', fomoScore: 315 },
  { rank: 6, ticker: 'AVAX', name: 'Avalanche',       mentions: 15, bullishVotes: 76,  bearishVotes: 22,  sentiment: 'bullish', fomoScore: 236 },
  { rank: 7, ticker: 'PEPE', name: 'Pepe',            mentions: 13, bullishVotes: 55,  bearishVotes: 48,  sentiment: 'neutral', fomoScore: 161 },
  { rank: 8, ticker: 'INJ',  name: 'Injective',       mentions: 10, bullishVotes: 82,  bearishVotes: 8,   sentiment: 'bullish', fomoScore: 157 },
  { rank: 9, ticker: 'ARB',  name: 'Arbitrum',        mentions: 9,  bullishVotes: 44,  bearishVotes: 35,  sentiment: 'neutral', fomoScore: 113 },
  { rank: 10,ticker: 'WIF',  name: 'Dogwifhat',       mentions: 8,  bullishVotes: 30,  bearishVotes: 62,  sentiment: 'bearish', fomoScore: 71  },
];

export async function fetchFomoCoins(authToken: string): Promise<FomoCoin[]> {
  const url =
    `https://cryptopanic.com/api/v1/posts/?auth_token=${authToken}` +
    `&filter=hot&public=true&kind=news`;

  const res = await fetch(url);

  if (res.status === 403) throw new Error('auth');
  if (res.status === 429) throw new Error('ratelimit');
  if (!res.ok) throw new Error(`http_${res.status}`);

  const data: CPResponse = await res.json();

  // Aggregate mentions and votes per coin ticker
  const map = new Map<string, { name: string; mentions: number; bull: number; bear: number }>();

  for (const post of data.results) {
    for (const cur of post.currencies ?? []) {
      const prev = map.get(cur.code);
      const bull = (post.votes.positive ?? 0) + (post.votes.liked ?? 0);
      const bear = (post.votes.negative ?? 0) + (post.votes.disliked ?? 0);
      if (prev) {
        prev.mentions += 1;
        prev.bull += bull;
        prev.bear += bear;
      } else {
        map.set(cur.code, { name: cur.title, mentions: 1, bull, bear });
      }
    }
  }

  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, 10);

  return sorted.map(([ticker, d], i) => {
    const total = d.bull + d.bear;
    const ratio = total > 0 ? (d.bull - d.bear) / total : 0;
    const sentiment: FomoCoin['sentiment'] =
      ratio > 0.12 ? 'bullish' : ratio < -0.12 ? 'bearish' : 'neutral';
    const fomoScore = Math.max(1, Math.round(d.mentions * 13 + (d.bull - d.bear) * 0.4));
    return {
      rank: i + 1,
      ticker,
      name: d.name,
      mentions: d.mentions,
      bullishVotes: d.bull,
      bearishVotes: d.bear,
      sentiment,
      fomoScore,
    };
  });
}
