// The token radar's model: one sealed snapshot of the protocol universe in, one ranked board out.
//
// WHAT THE BOARD IS
// The board ranks every protocol the snapshot records as pre-token that is a legitimate launch
// candidate: it records no token (mcap_usd, gecko_id and symbol are all null), it is not a
// wrapped, staked or bridged product of a protocol whose token already trades, and it is not a
// versioned pool or an exchange. The snapshot's watchlist (40 protocols) is the floor, never the
// ceiling: the board adds every other protocol that passes the same rule below the $50M floor.
// Protocols whose token already trades are never ranked; the dashboard shows the biggest of them
// apart, with their market caps, so the board separates "still to come" from "already trades".
//
// THE IMPLIED-VALUE MODEL (radar-2, computed fresh from the snapshot on every run)
// For each category, the model takes the median market-cap / TVL ratio of the tokenized
// protocols in that same category, in this same snapshot, and shrinks it toward the global
// median when the category has few comparables. That multiple is the category's own claim about
// what a unit of TVL is worth as a token; no protocol name is ever special-cased and no multiple
// is ever hand-written.
//
//   catMultiple = clip((n * catMedian + 5 * globalMedian) / (n + 5), 0.05, 1.5)
//   growthMult  = 1 + clamp(change_7d, -40, 80) / 100 * 0.5        (0.80 .. 1.40)
//   maturityMult = 0.70 + min(age_days, 1095) / 1095 * 0.30         (0.70 .. 1.00)
//   breadthMult = 1 + 0.03 * min(chains - 1, 5)                     (1.00 .. 1.15)
//   implied     = round(tvl_usd * catMultiple * growthMult * maturityMult * breadthMult)
//
// Each comparable's mcap/TVL ratio is winsorized to [0.01, 2.00] before the median is
// taken: a token with almost no TVL in DefiLlama can carry a ratio in the hundreds, and
// one such record must not set a whole category's multiple.
//
// Growth rewards momentum and punishes shrinkage, bounded so one wild week cannot dominate.
// Maturity rewards how long a protocol has run with no token on record: the longer it has run,
// the more "overdue" a launch would be, and the more history a farmer can read. Breadth rewards
// being live on several chains, capped at five extra chains. Age is days since listed_at; when
// the snapshot reports none, 365 days is used and the row says so.
//
// LIMITS, STATED PLAINLY
// Implied value is this entry's own claim, never make.fun's and never a price. It does not
// predict whether or when a protocol issues a token: a protocol that records no token may still
// have one its DefiLlama record does not carry, and a high implied value is not a promise of an
// airdrop. Category medians are noisy where a category has few tokenized comparables, which is
// exactly why the shrinkage toward the global median exists; the dashboard shows each row's
// multiple and how many comparables back it.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  shrink_prior: number;
  multiple_floor: number;
  multiple_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
  ratio_floor: number;
  ratio_cap: number;
}

export const MODEL: ModelConstants = {
  shrink_prior: 5,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 80,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_per_chain: 0.03,
  breadth_max_chains: 5,
  ratio_floor: 0.01,
  ratio_cap: 2.0,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One category's comparables: how many tokenized protocols back its multiple, and the multiple. */
export interface CategoryMultiple {
  category: string;
  comparables: number;
  category_median: number | null;
  multiple: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    comparables: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  comparables: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the multiples, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  multiples: CategoryMultiple[];
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted array, or null when empty. */
function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The category multiples, derived from the snapshot's own tokenized protocols. For each
 * category: the median mcap/TVL of its tokenized protocols, shrunk toward the global median
 * with a prior of `shrink_prior` comparables, then clipped. Categories with no tokenized
 * protocol at all take the global median. Deterministic: medians of sorted arrays.
 */
export function categoryMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { global: number; byCategory: Map<string, CategoryMultiple> } {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      // Winsorize the ratio before it enters any median: one token with almost no TVL
      // must not set its category's multiple.
      const ratio = Math.min(model.ratio_cap, Math.max(model.ratio_floor, p.mcap_usd / p.tvl_usd));
      all.push(ratio);
      const key = p.category ?? 'Other';
      const list = byCat.get(key);
      if (list) list.push(ratio);
      else byCat.set(key, [ratio]);
    }
  }
  all.sort((a, b) => a - b);
  const global = median(all) ?? 0.2;
  const out = new Map<string, CategoryMultiple>();
  for (const [cat, ratios] of byCat) {
    ratios.sort((a, b) => a - b);
    const catMed = median(ratios);
    const n = ratios.length;
    const shrunk = catMed === null ? global : (n * catMed + model.shrink_prior * global) / (n + model.shrink_prior);
    const multiple = Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk));
    out.set(cat, { category: cat, comparables: n, category_median: catMed === null ? null : Math.round(catMed * 1e4) / 1e4, multiple: Math.round(multiple * 1e4) / 1e4 });
  }
  return { global: Math.round(global * 1e4) / 1e4, byCategory: out };
}

/** The multiple one protocol's category gets, falling back to the global median. */
export function multipleFor(category: string | null, multiples: { global: number; byCategory: Map<string, CategoryMultiple> }): CategoryMultiple {
  const found = multiples.byCategory.get(category ?? 'Other');
  if (found) return found;
  return { category: category ?? 'Other', comparables: 0, category_median: null, multiple: multiples.global };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { global: number; byCategory: Map<string, CategoryMultiple> },
  model: ModelConstants,
): { implied: number; catMultiple: number; comparables: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const cat = multipleFor(protocol.category, multiples);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains);
  const breadthMult = 1 + model.breadth_per_chain * extraChains;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * cat.multiple * growthMult * maturityMult * breadthMult));
  return { implied, catMultiple: cat.multiple, comparables: cat.comparables, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking in a name: a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the start of a protocol name. */
const EXCHANGE_PREFIX = /^(binance|coinbase|bybit|kraken|bitget|okx|bitfinex|gemini)\b/i;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a protocol whose token already trades (the house rule, applied to the
 * ten fields the snapshot carries), not an exchange and not a versioned pool. WBTC, Binance
 * staked ETH and USDT0 fail this rule on purpose: each is a token that already trades, worn
 * as another protocol's product.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const multiples = categoryMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, if the snapshot carries it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other pre-token protocol that passes the same rule, whatever its
  // size. The watchlist is a floor, never a ceiling, and the board is the whole legitimate
  // pre-token universe the snapshot holds, not a top-N cut of it.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.catMultiple),
      comparables: s.comparables,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) {
    return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open, borrowing a small amount once to show use.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) {
    return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open through at least one fee cycle.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares for the full hold period.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trading')) {
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position, then close it after a week.`;
  }
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then settle it when the market resolves.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the protocol.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in your wallet.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the hold period.`;
  if (c.includes('governance')) return `Deposit $${capital} into ${name} on ${chain} and vote in its next governance round from the same wallet.`;
  if (c.includes('index')) return `Deposit $${capital} into ${name}'s index vault on ${chain} and keep the position open.`;
  if (c.includes('otc')) return `Complete one small OTC trade of $${capital} through ${name} on ${chain} and keep the receipt.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and use its main feature once a week.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list
 * of names. The last step is the honest caveat: recording no token is not a promise of one.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, from the same wallet.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from a link it publishes; never pay a fee to claim.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Remember this protocol only records no token, which is not a promise of a launch or an airdrop, so never spend more than you can afford to lose, and log the wallet, dates and transactions.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    comparables: row.model.comparables,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const multiples = categoryMultiples(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const multList = [...multiples.byCategory.values()].sort((a, b) => b.comparables - a.comparables || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: multiples.global,
    multiples: multList,
    watchlist: [...snapshot.watchlist].sort(),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
