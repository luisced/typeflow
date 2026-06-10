// Bundled, offline content. A curated set of common English words plus quotes.

const WORDS = `the be of and a to in he have it that for they i with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold govern around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line city put close case force meet once water upon war build hear light unite live every country bring center let side try provide continue name certain power pay result question study woman member until far night always service away report something company week church toward start social room figure nature though young less enough almost read include president nothing yet better big boy cost business value second why clear expect family complete act sense mind experience art next near direct car law industry important girl god several matter usual rather per often kind among white reason action return foot care simple within love human along appear doctor believe speak active student month drive concern best door hope example inform body ever least probably understand reach effect different idea whole control condition field pass fall note special talk particular today measure walk teach low hour type carry rate remain full street easy though stop fail oh whether produce cut finally perhaps require result education whose offer happen total national sound thus value voice age across already success approach single rule daughter movement price effort decide rest rise general feature wide cover common subject press lot lie relation medium close`.split(/\s+/);

export const QUOTES: string[] = [
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
];

function initialWords(count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    out.push(...WORDS);
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

/** Generate `count` random words for words/time modes. */
export function sampleWords(count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    out.push(...shuffle(WORDS));
  }
  return out.slice(0, count);
}

export function initialSampleWords(count: number): string[] {
  return initialWords(count);
}

let lastQuoteIndex = -1;

export function randomQuote(): string[] {
  let i = Math.floor(Math.random() * QUOTES.length);
  // never serve the same quote twice in a row
  if (QUOTES.length > 1 && i === lastQuoteIndex) i = (i + 1) % QUOTES.length;
  lastQuoteIndex = i;
  return QUOTES[i].split(" ");
}

export function initialQuote(): string[] {
  return QUOTES[0].split(" ");
}
