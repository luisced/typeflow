import {
  normalizeContentFlags,
  type ContentFlags,
} from "./contentFlags";

// Bundled, offline content organized as per-language packs. Only "en" ships
// today; new languages register a pack here and thread a `language` value
// through TestConfig/RunRecord (which already carry the field).

export interface LanguagePack {
  /** Curated common words for words/time/practice modes. */
  words: string[];
  /** Short quotes for quote mode. */
  quotes: string[];
}

export const DEFAULT_LANGUAGE = "en";

const EN_PACK: LanguagePack = {
  words: `the be of and a to in he have it that for they i with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line city put close case force meet once water upon war build hear light unite live every country bring center let side try provide continue name certain power pay result question study woman member until far night always service away report something company week church toward start social room figure nature though young less enough almost read include president nothing yet better big boy cost business value second why clear expect family complete act sense mind experience art next near direct car law industry important girl god several matter usual rather per often kind among white reason action return foot care simple within love human along appear doctor believe speak active student month drive concern best door hope example inform body ever least probably understand reach effect different idea whole control condition field pass fall note special talk particular today measure walk teach low hour type carry rate remain full street easy though stop fail oh whether produce cut finally perhaps require result education whose offer happen total national sound thus value voice age across already success approach single rule daughter movement price effort decide rest rise general feature wide cover common subject press lot lie relation medium close`.split(
    /\s+/
  ),
  quotes: [
    "The only way to do great work is to love what you do.",
    "Simplicity is the ultimate sophistication.",
    "Stay hungry, stay foolish, and keep moving forward every single day.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "It always seems impossible until it is done, so begin now.",
    "Quality is not an act, it is a habit formed over many small moments.",
    "The best way to predict the future is to invent it yourself.",
    "What we think, we become, and what we practice, we master.",
    "Do not wait for the perfect moment, take the moment and make it perfect.",
    "Creativity is intelligence having fun while solving real problems.",
    "The secret of getting ahead is getting started before you feel ready.",
    "A smooth sea never made a skilled sailor worth remembering.",
    "Discipline is choosing between what you want now and what you want most.",
    "Small daily improvements over time lead to stunning long term results.",
    "The mind is everything; what you think, you slowly come to be.",
    "Words are, in my opinion, our most inexhaustible source of magic.",
    "Focus on being productive instead of merely staying busy all day.",
    "Great things are not done by impulse but by a series of small things.",
  ],
};

const PACKS: Record<string, LanguagePack> = {
  en: EN_PACK,
};

export function availableLanguages(): string[] {
  return Object.keys(PACKS);
}

export function getLanguagePack(language?: string | null): LanguagePack {
  return PACKS[language ?? DEFAULT_LANGUAGE] ?? PACKS[DEFAULT_LANGUAGE];
}

// Back-compat aliases for the default pack.
export const WORDS = EN_PACK.words;
export const QUOTES = EN_PACK.quotes;

function initialWords(count: number, language?: string | null): string[] {
  const { words } = getLanguagePack(language);
  const out: string[] = [];
  while (out.length < count) {
    out.push(...words);
  }
  return out.slice(0, count);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function baseSampleWords(count: number, language?: string | null): string[] {
  const { words } = getLanguagePack(language);
  const out: string[] = [];
  while (out.length < count) {
    out.push(...shuffle(words));
  }
  return out.slice(0, count);
}

const PUNCT_END = [".", ",", "!", "?", ";", ":"];
const PUNCT_WEIGHTS = [40, 35, 8, 8, 5, 4];

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function maybeNumberToken(): string {
  const digits = 1 + Math.floor(Math.random() * 4);
  let n = "";
  for (let i = 0; i < digits; i++) n += Math.floor(Math.random() * 10);
  if (Math.random() < 0.15) {
    const commaAt = Math.max(1, n.length - 3);
    n = `${n.slice(0, commaAt)},${n.slice(commaAt)}`;
  } else if (Math.random() < 0.1 && digits >= 2) {
    const dotAt = Math.max(1, n.length - 2);
    n = `${n.slice(0, dotAt)}.${n.slice(dotAt)}`;
  }
  return n;
}

function capitalizeCore(word: string): string {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1);
}

function capitalizeToken(word: string): string {
  const lead = word.match(/^["(]/)?.[0] ?? "";
  const rest = lead ? word.slice(1) : word;
  return lead + capitalizeCore(rest);
}

function endsSentence(word: string): boolean {
  return /[.!?]$/.test(word);
}

/** Post-sample transforms for time/words/practice modes. Quotes ignore flags. */
export function applyContentFlags(
  words: string[],
  flags?: ContentFlags | null
): string[] {
  const f = normalizeContentFlags(flags);
  if (!f.capitals && !f.numbers && !f.punctuation) return words.slice();

  let out = words.map((w) => w);

  if (f.numbers) {
    out = out.map((w) => (Math.random() < 0.08 ? maybeNumberToken() : w));
  }

  if (f.punctuation) {
    out = out.map((w) => {
      if (Math.random() < 0.03) {
        const inner = w.replace(/[.,!?;:]+$/g, "");
        return Math.random() < 0.5 ? `"${inner}"` : `(${inner})`;
      }
      if (Math.random() < 0.25) {
        const bare = w.replace(/[.,!?;:]+$/g, "");
        return bare + weightedPick(PUNCT_END, PUNCT_WEIGHTS);
      }
      return w;
    });
  }

  if (f.capitals) {
    if (out.length > 0) out[0] = capitalizeToken(out[0]);
    for (let i = 1; i < out.length; i++) {
      if (endsSentence(out[i - 1]) || Math.random() < 0.1) {
        out[i] = capitalizeToken(out[i]);
      }
    }
  }

  return out;
}

/** Generate `count` random words for words/time modes, with optional content flags. */
export function sampleWords(
  count: number,
  flags?: ContentFlags | null,
  language?: string | null
): string[] {
  return applyContentFlags(baseSampleWords(count, language), flags);
}

export function initialSampleWords(
  count: number,
  flags?: ContentFlags | null,
  language?: string | null
): string[] {
  return applyContentFlags(initialWords(count, language), flags);
}

function wordWeaknessScore(
  word: string,
  charScore: (ch: string) => number
): number {
  if (!word) return 0;
  let sum = 0;
  for (const ch of word) sum += charScore(ch);
  return sum / word.length;
}

/** Practice-mode sampler: biased toward weak chars, ≥30% uniform random. */
export function practiceSampleWords(
  count: number,
  weakChars: string[],
  charScore: (ch: string) => number,
  flags?: ContentFlags | null,
  language?: string | null
): string[] {
  const weakSet = new Set(weakChars);
  const pool = getLanguagePack(language).words.filter((w) => w.length > 0);
  const biased = pool.filter((w) => [...w].some((ch) => weakSet.has(ch)));
  const source = biased.length > 0 ? biased : pool;

  const out: string[] = [];
  while (out.length < count) {
    const uniform = Math.random() < 0.3 || source.length === 0;
    let pick: string;
    if (uniform) {
      pick = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const weights = source.map((w) => {
        const s = wordWeaknessScore(w, charScore);
        return Math.max(0.001, s * s);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      pick = source[source.length - 1];
      for (let i = 0; i < source.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          pick = source[i];
          break;
        }
      }
    }
    out.push(pick);
  }

  return applyContentFlags(out.slice(0, count), flags);
}

export function initialPracticeWords(
  count: number,
  flags?: ContentFlags | null,
  language?: string | null
): string[] {
  return applyContentFlags(initialWords(count, language), flags);
}

let lastQuoteIndex = -1;

export function randomQuote(language?: string | null): string[] {
  const { quotes } = getLanguagePack(language);
  let i = Math.floor(Math.random() * quotes.length);
  // never serve the same quote twice in a row
  if (quotes.length > 1 && i === lastQuoteIndex) i = (i + 1) % quotes.length;
  lastQuoteIndex = i;
  return quotes[i].split(" ");
}

export function initialQuote(language?: string | null): string[] {
  return getLanguagePack(language).quotes[0].split(" ");
}
