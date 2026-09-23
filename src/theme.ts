/**
 * Two dressings for one island.
 *
 * The simulation is the same either way: same seed, same trees, same save. A
 * theme is only what the island is made of and what its people say, so the
 * default — Robin's bright little island — is untouched and the goblin fork in
 * docs/GOBLIN_FORK.md gets somewhere to be looked at rather than only read.
 *
 * Nothing here is game logic. A theme is picked once per page load, because
 * scene materials are built at import time and swapping them live would mean
 * rebuilding every mesh for no gain the reload does not already give.
 */

export type ThemeId = 'island' | 'goblin';

/** Colours and numbers the renderer builds the world out of. */
export type ScenePalette = {
  background: string; fog: [near: number, far: number];
  water: { color: string; roughness: number; metalness: number };
  sky: string; ground: string; ambient: number;
  sun: { color: string; intensity: number; at: [x: number, y: number, z: number] };
  exposure: number;
  /** Island rings, outermost first: waterline, shore, upper shore, and the body of the land. */
  land: [waterline: string, shore: string, upper: string, body: string];
  shoreline: string; clearing: string;
  bark: string; barkCut: string; leaves: [string, string, string, string];
  rock: [string, string]; tuft: [string, string]; bloom: string;
  hoverRing: string; orderRing: string;
  motes: { color: string; size: number };
  sign: string;
};

export type Copy = {
  documentTitle: string; themeColor: string;
  brand: string; brandSub: string; brandAria: string;
  canvasAria: string;
  day: string; daySub: string;
  ware: string;
  villager: string; villagerRole: string; findVillager: string;
  objectiveTitle: string;
  objectiveStart: string; objectiveBusy: string;
  objectiveWaiting: (n: number) => string; objectiveStock: (n: number) => string;
  tooltipSelect: string; tooltipCancel: string;
  workLabel: string;
  hint: string;
  /** The status line under the portrait. Pillar 5: somebody says something. */
  status: { paused: string; carrying: string; working: string; walking: string; roaming: string; idle: string };
  toastFirst: string; toastMore: (total: number) => string;
  toastCancelled: string; toastPaused: string; toastFresh: string;
  rejections: Record<'unknown-site' | 'already-spent' | 'already-ordered' | 'queue-full', string>;
  help: { eyebrow: string; heading: string; body: string; rows: [string, string][]; save: string; start: string };
  reset: { eyebrow: string; heading: string; body: string; keep: string; confirm: string };
  cameraHint: [string, string, string];
  switchTo: ThemeId; switchLabel: string;
};

export type Theme = { id: ThemeId; scene: ScenePalette; copy: Copy };

const island: Theme = {
  id: 'island',
  scene: {
    background: '#b9d4ca', fog: [65, 160],
    water: { color: '#84b9ad', roughness: .34, metalness: .07 },
    sky: '#fff7dd', ground: '#7e9d86', ambient: 1.7,
    sun: { color: '#fff0c4', intensity: 2.8, at: [-22, 36, 20] }, exposure: 1.05,
    land: ['#d9c991', '#d9c991', '#b6bc73', '#a3b968'],
    shoreline: '#e1eee1', clearing: '#c1bc83',
    bark: '#845335', barkCut: '#c58d58', leaves: ['#72933f', '#8aab4b', '#4f7e48', '#a6b95b'],
    rock: ['#aaa994', '#c4bca1'], tuft: ['#869c4c', '#c7c981'], bloom: '#f3dc9a',
    hoverRing: '#fffbe8', orderRing: '#c8802c',
    motes: { color: '#e3bc77', size: .11 },
    sign: '#e9d7a4',
  },
  copy: {
    documentTitle: 'Little Island — one log home', themeColor: '#dde8d5',
    brand: 'LITTLE ISLAND', brandSub: 'ONE ISLAND · ONE PAIR OF HANDS', brandAria: 'Little Island home',
    canvasAria: 'Interactive island. Drag to orbit, right drag to pan, scroll to zoom. Click a tree to fell it.',
    day: 'Day 01', daySub: 'A little room to grow',
    ware: 'Logs',
    villager: 'Robin', villagerRole: 'YOUR VILLAGER', findVillager: 'Find Robin',
    objectiveTitle: 'A log to call your own',
    objectiveStart: 'Click a tree. Robin will take it from here.',
    objectiveBusy: 'Robin will bring your first log home.',
    objectiveWaiting: n => `${n} more ${n === 1 ? 'tree' : 'trees'} on the list.`,
    objectiveStock: n => `${n} ${n === 1 ? 'log' : 'logs'} gathered. Your small beginning is growing.`,
    tooltipSelect: 'Select to gather', tooltipCancel: 'Click to call it off',
    workLabel: 'CHOPPING',
    hint: 'Click a tree to gather logs',
    status: {
      paused: 'Enjoying a quiet moment', carrying: 'Bringing a log home',
      working: 'Chop, chop. Making progress.', walking: 'On the way to a tree',
      roaming: 'Having a wander', idle: 'Taking it all in',
    },
    toastFirst: 'Your first log. Every little world starts somewhere.',
    toastMore: total => `+1 log · ${total} in the pile`,
    toastCancelled: 'Called off. No harm done.',
    toastPaused: 'Noted. Press play when you’re ready.',
    toastFresh: 'A fresh island. A world of possibility.',
    rejections: {
      'unknown-site': 'That one is out of reach.',
      'already-spent': 'That tree is already down.',
      'already-ordered': 'Already on the list.',
      'queue-full': 'That is plenty of work for one pair of hands.',
    },
    help: {
      eyebrow: 'WELCOME TO LITTLE ISLAND', heading: 'Make yourself at home.',
      body: 'This is a small, peaceful place to begin. Select a tree and Robin will walk over, chop it down, and carry a log back to the clearing. Line up a few and they become a list of work.',
      rows: [['Look around', 'Drag to orbit · scroll to zoom'], ['Move your view', 'Right drag or two-finger drag'], ['Change your mind', 'Click a marked tree to call it off'], ['Take your time', 'Space to pause · 1× to change pace']],
      save: 'Your island saves automatically in this browser.',
      start: 'Let’s get growing',
    },
    reset: {
      eyebrow: 'A FRESH START', heading: 'A new little beginning?',
      body: 'This will replace your saved island and its logs with a fresh island.',
      keep: 'Keep my island', confirm: 'Start fresh',
    },
    cameraHint: ['DRAG TO ORBIT', 'SCROLL TO ZOOM', 'RIGHT DRAG TO PAN'],
    switchTo: 'goblin', switchLabel: 'Visit the goblin fork',
  },
};

/**
 * The goblin fork, dressed. Everything here answers something written down in
 * docs/GOBLIN_FORK.md: peat light and a bog underfoot for the decay layer, trees too
 * big to fell that grow fungus instead, a settlement that is three sticks and a
 * covered pit, and a HUD that grumbles rather than warns.
 *
 * Cozy is the constraint that keeps it out of the swamp-horror register: damp,
 * dim and mushroomy, but warm where the goblins are — the ember at the camp is
 * the brightest thing on the island, and it is meant to be.
 */
const goblin: Theme = {
  id: 'goblin',
  scene: {
    // Overcast peat light, and fog pulled in close so the big trees loom out of it.
    background: '#a9b09b', fog: [45, 135],
    water: { color: '#3f4a3a', roughness: .2, metalness: .12 },
    sky: '#dfe4cb', ground: '#4b5540', ambient: 1.35,
    sun: { color: '#e8e2bb', intensity: 1.9, at: [-18, 26, 24] }, exposure: .98,
    land: ['#78724f', '#6a6544', '#5c6440', '#55603a'],
    shoreline: '#cdd6bb', clearing: '#5e5c44',
    bark: '#4a4035', barkCut: '#d8b785', leaves: ['#3d5a36', '#476439', '#2f4a31', '#57703f'],
    rock: ['#7f8474', '#95978a'], tuft: ['#5f7340', '#8a8f56'], bloom: '#e4d9b4',
    hoverRing: '#f2ecd0', orderRing: '#d59a3c',
    // Spores, not woodchips: paler, larger, and they drift instead of flying.
    motes: { color: '#e6e8c8', size: .14 },
    sign: '#b8a57a',
  },
  copy: {
    documentTitle: 'Little Island — the goblin fork', themeColor: '#b8bda8',
    brand: 'LITTLE ISLAND', brandSub: 'THE GOBLIN FORK · DAMP, BUT OURS', brandAria: 'Little Island home',
    canvasAria: 'Interactive bog island. Drag to orbit, right drag to pan, scroll to zoom. Click a tree to work it for timber.',
    day: 'Day 01', daySub: 'Nobody has caught a chill yet',
    ware: 'Logs',
    villager: 'Gnarlfoot', villagerRole: 'YOUR GOBLIN', findVillager: 'Find Gnarlfoot',
    objectiveTitle: 'Something to keep the damp off',
    objectiveStart: 'Point at a tree. Gnarlfoot will grumble, and then go.',
    objectiveBusy: 'She is on it. She would like that noted.',
    objectiveWaiting: n => `${n} more ${n === 1 ? 'tree' : 'trees'} on the list. She has counted them.`,
    objectiveStock: n => `${n} ${n === 1 ? 'log' : 'logs'} in the stack, tidy and off the wet ground.`,
    tooltipSelect: 'Set her on it', tooltipCancel: 'Click to call it off',
    workLabel: 'WEDGE & MALLET',
    hint: 'Click a tree to put it on the list',
    status: {
      paused: 'Sat down. She has earned it, she reckons.',
      carrying: 'It is not heavy. It is awkward. There is a difference.',
      working: 'Wedge. Mallet. Mutter. Repeat.',
      walking: 'Trudging out to the big one.',
      roaming: 'Off for a wander. Nobody asked her to.',
      idle: 'Having a think. Or a sulk. Hard to tell.',
    },
    toastFirst: 'One log. Took the two of us, and there is only one of me.',
    toastMore: total => `+1 log · ${total} on the stack. Tidy.`,
    toastCancelled: 'Called off. She is not sorry.',
    toastPaused: 'Noted. She will be over here, not hurrying.',
    toastFresh: 'A new bog. Same mushrooms, probably.',
    rejections: {
      'unknown-site': 'That one is out in the wet. Not today.',
      'already-spent': 'That one is down. The mushrooms have it now.',
      'already-ordered': 'On the list. She did hear you.',
      'queue-full': 'That is a week of work and there is one of her.',
    },
    help: {
      eyebrow: 'WELCOME TO THE BOG', heading: 'A well-run larder.',
      body: 'Goblins are not strong, so nothing here is felled in one go: Gnarlfoot walks out with a wedge and a mallet, works a tree apart, and staggers a log home to the covered pit. Line a few up and they become a list she will complain about.',
      rows: [['Look around', 'Drag to orbit · scroll to zoom'], ['Move your view', 'Right drag or two-finger drag'], ['Change your mind', 'Click a marked tree to call it off'], ['Take your time', 'Space to pause · 1× to change pace']],
      save: 'The bog remembers. It saves in this browser.',
      start: 'Right then',
    },
    reset: {
      eyebrow: 'START AGAIN', heading: 'Pack up and find another bog?',
      body: 'This replaces the island you have, and the logs Gnarlfoot hauled onto it.',
      keep: 'Keep this one', confirm: 'Find another bog',
    },
    cameraHint: ['DRAG TO ORBIT', 'SCROLL TO ZOOM', 'RIGHT DRAG TO PAN'],
    switchTo: 'island', switchLabel: 'Back to the bright island',
  },
};

export const THEMES: Record<ThemeId, Theme> = { island, goblin };

export const isThemeId = (value: unknown): value is ThemeId => value === 'island' || value === 'goblin';

/**
 * `?goblin` or `?theme=goblin` picks the fork; otherwise the last choice made on
 * this browser, otherwise the bright island. The URL wins over the remembered
 * choice so a shared link always opens the island it promised.
 */
export function chooseTheme(search: string, remembered?: string | null): ThemeId {
  const params = new URLSearchParams(search);
  if (params.has('goblin')) return 'goblin';
  const asked = params.get('theme');
  if (isThemeId(asked)) return asked;
  return isThemeId(remembered) ? remembered : 'island';
}

const THEME_KEY = 'little-island-theme';

/** The theme this page load is wearing. Read once; the renderer builds from it. */
export function activeTheme(): Theme {
  if (typeof location === 'undefined') return THEMES.island;
  let remembered: string | null = null;
  try { remembered = localStorage.getItem(THEME_KEY); } catch { /* Private browsing has no storage, and that is fine. */ }
  return THEMES[chooseTheme(location.search, remembered)];
}

/** Remember a choice and open that island. A reload is the whole switch. */
export function wearTheme(id: ThemeId): void {
  try { localStorage.setItem(THEME_KEY, id); } catch { /* Then the URL alone carries it. */ }
  const url = new URL(location.href);
  url.searchParams.delete('goblin');
  url.searchParams.set('theme', id);
  location.href = url.toString();
}
