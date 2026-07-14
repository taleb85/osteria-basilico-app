export interface BackgroundTheme {
  id: string;
  label: Record<string, string>;
  appBg: string;
  previewGradient: string;
  glows: Array<{
    color: string;
    opacity: number;
    blur: number;
    position: { top?: string; bottom?: string; left?: string; right?: string };
    size: string;
  }>;
  accentLine: string;
  starColor: string;
  waveOpacity: number;
}

const THEMES: BackgroundTheme[] = [
  {
    id: 'carbon',
    label: { it: 'Carbonio', en: 'Carbon' },
    appBg: '#0a0a0c',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(255,149,0,0.18) 0%, rgba(160,120,80,0.08) 30%, transparent 70%)',
    glows: [
      { color: '#fb923c', opacity: 0.12, blur: 180, position: { top: '-6rem' }, size: '40rem 56rem' },
      { color: '#fed7aa', opacity: 0.08, blur: 140, position: { top: '-4rem', right: '10%' }, size: '28rem 32rem' },
      { color: '#fcd34d', opacity: 0.09, blur: 150, position: { bottom: '20%', right: '8%' }, size: '26rem 30rem' },
      { color: '#7dd3fc', opacity: 0.06, blur: 140, position: { top: '20%', left: '-6rem' }, size: '24rem 28rem' },
      { color: '#a78bfa', opacity: 0.06, blur: 130, position: { bottom: '-6rem', left: '20%' }, size: '20rem 26rem' },
      { color: '#f9a8d4', opacity: 0.05, blur: 120, position: { bottom: '5%', right: '-5rem' }, size: '16rem 20rem' },
    ],
    accentLine: 'rgba(255,255,255,0.08)',
    starColor: '255,255,255',
    waveOpacity: 0.07,
  },
  {
    id: 'noir',
    label: { it: 'Notte', en: 'Night' },
    appBg: '#050508',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(96,165,250,0.14) 0%, rgba(60,80,120,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#60a5fa', opacity: 0.10, blur: 200, position: { top: '-5rem', left: '50%' }, size: '44rem 60rem' },
      { color: '#818cf8', opacity: 0.07, blur: 160, position: { top: '-2rem', right: '5%' }, size: '30rem 36rem' },
      { color: '#38bdf8', opacity: 0.08, blur: 170, position: { bottom: '15%', right: '12%' }, size: '28rem 32rem' },
      { color: '#a78bfa', opacity: 0.06, blur: 150, position: { top: '30%', left: '-8rem' }, size: '22rem 26rem' },
      { color: '#c084fc', opacity: 0.05, blur: 140, position: { bottom: '-4rem', left: '10%' }, size: '18rem 22rem' },
      { color: '#67e8f9', opacity: 0.04, blur: 130, position: { bottom: '8%', right: '-3rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(148,197,255,0.08)',
    starColor: '148,197,255',
    waveOpacity: 0.06,
  },
  {
    id: 'sangria',
    label: { it: 'Borgogna', en: 'Burgundy' },
    appBg: '#0d080a',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(190,60,80,0.12) 0%, rgba(100,40,50,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#fb7185', opacity: 0.10, blur: 180, position: { top: '-5rem', left: '50%' }, size: '40rem 56rem' },
      { color: '#f472b6', opacity: 0.07, blur: 150, position: { top: '-3rem', right: '8%' }, size: '26rem 30rem' },
      { color: '#e879f9', opacity: 0.08, blur: 160, position: { bottom: '20%', right: '5%' }, size: '24rem 28rem' },
      { color: '#fb923c', opacity: 0.05, blur: 140, position: { top: '25%', left: '-5rem' }, size: '20rem 24rem' },
      { color: '#a78bfa', opacity: 0.05, blur: 130, position: { bottom: '-5rem', left: '15%' }, size: '18rem 22rem' },
      { color: '#f43f5e', opacity: 0.04, blur: 120, position: { bottom: '10%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(251,113,133,0.08)',
    starColor: '251,113,133',
    waveOpacity: 0.06,
  },
  {
    id: 'midnight',
    label: { it: 'Blu notte', en: 'Midnight' },
    appBg: '#050a14',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.14) 0%, rgba(30,60,120,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#3b82f6', opacity: 0.11, blur: 200, position: { top: '-6rem', left: '50%' }, size: '44rem 60rem' },
      { color: '#60a5fa', opacity: 0.07, blur: 160, position: { top: '-3rem', right: '12%' }, size: '28rem 34rem' },
      { color: '#818cf8', opacity: 0.08, blur: 170, position: { bottom: '18%', right: '6%' }, size: '26rem 30rem' },
      { color: '#1d4ed8', opacity: 0.06, blur: 150, position: { top: '22%', left: '-7rem' }, size: '22rem 26rem' },
      { color: '#a78bfa', opacity: 0.05, blur: 140, position: { bottom: '-4rem', left: '22%' }, size: '18rem 22rem' },
      { color: '#38bdf8', opacity: 0.04, blur: 130, position: { bottom: '6%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(96,165,250,0.08)',
    starColor: '96,165,250',
    waveOpacity: 0.06,
  },
  {
    id: 'slate',
    label: { it: 'Ardesia', en: 'Slate' },
    appBg: '#0a0a0e',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(148,163,184,0.10) 0%, rgba(80,90,110,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#94a3b8', opacity: 0.09, blur: 190, position: { top: '-5rem', left: '50%' }, size: '40rem 56rem' },
      { color: '#cbd5e1', opacity: 0.06, blur: 150, position: { top: '-2rem', right: '10%' }, size: '26rem 30rem' },
      { color: '#5eead4', opacity: 0.07, blur: 160, position: { bottom: '20%', right: '8%' }, size: '24rem 28rem' },
      { color: '#67e8f9', opacity: 0.05, blur: 140, position: { top: '25%', left: '-6rem' }, size: '20rem 24rem' },
      { color: '#a78bfa', opacity: 0.04, blur: 130, position: { bottom: '-4rem', left: '18%' }, size: '18rem 22rem' },
      { color: '#94a3b8', opacity: 0.04, blur: 120, position: { bottom: '8%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(148,163,184,0.07)',
    starColor: '148,163,184',
    waveOpacity: 0.05,
  },
  {
    id: 'obsidian',
    label: { it: 'Ossidiana', en: 'Obsidian' },
    appBg: '#0a0706',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(251,146,60,0.14) 0%, rgba(80,50,30,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#fb923c', opacity: 0.11, blur: 190, position: { top: '-5rem', left: '50%' }, size: '40rem 56rem' },
      { color: '#fbbf24', opacity: 0.08, blur: 150, position: { top: '-3rem', right: '8%' }, size: '26rem 30rem' },
      { color: '#f97316', opacity: 0.09, blur: 160, position: { bottom: '18%', right: '10%' }, size: '24rem 28rem' },
      { color: '#fcd34d', opacity: 0.05, blur: 140, position: { top: '28%', left: '-6rem' }, size: '20rem 24rem' },
      { color: '#a78bfa', opacity: 0.04, blur: 130, position: { bottom: '-5rem', left: '22%' }, size: '18rem 22rem' },
      { color: '#f59e0b', opacity: 0.04, blur: 120, position: { bottom: '7%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(251,146,60,0.08)',
    starColor: '251,146,60',
    waveOpacity: 0.07,
  },
  {
    id: 'ivy',
    label: { it: 'Edera', en: 'Ivy' },
    appBg: '#070a08',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(52,211,153,0.10) 0%, rgba(30,80,60,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#34d399', opacity: 0.09, blur: 190, position: { top: '-5rem', left: '50%' }, size: '40rem 56rem' },
      { color: '#6ee7b7', opacity: 0.06, blur: 150, position: { top: '-2rem', right: '10%' }, size: '26rem 30rem' },
      { color: '#2dd4bf', opacity: 0.07, blur: 160, position: { bottom: '20%', right: '8%' }, size: '24rem 28rem' },
      { color: '#67e8f9', opacity: 0.05, blur: 140, position: { top: '25%', left: '-6rem' }, size: '20rem 24rem' },
      { color: '#a78bfa', opacity: 0.04, blur: 130, position: { bottom: '-4rem', left: '18%' }, size: '18rem 22rem' },
      { color: '#34d399', opacity: 0.04, blur: 120, position: { bottom: '8%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(52,211,153,0.07)',
    starColor: '52,211,153',
    waveOpacity: 0.05,
  },
  {
    id: 'plum',
    label: { it: 'Prugna', en: 'Plum' },
    appBg: '#0b080e',
    previewGradient: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.12) 0%, rgba(80,60,100,0.06) 30%, transparent 70%)',
    glows: [
      { color: '#a78bfa', opacity: 0.10, blur: 190, position: { top: '-5rem', left: '50%' }, size: '40rem 56rem' },
      { color: '#c084fc', opacity: 0.07, blur: 150, position: { top: '-3rem', right: '8%' }, size: '26rem 30rem' },
      { color: '#e879f9', opacity: 0.08, blur: 160, position: { bottom: '20%', right: '5%' }, size: '24rem 28rem' },
      { color: '#818cf8', opacity: 0.05, blur: 140, position: { top: '25%', left: '-6rem' }, size: '20rem 24rem' },
      { color: '#f472b6', opacity: 0.05, blur: 130, position: { bottom: '-5rem', left: '20%' }, size: '18rem 22rem' },
      { color: '#a78bfa', opacity: 0.04, blur: 120, position: { bottom: '8%', right: '-4rem' }, size: '14rem 18rem' },
    ],
    accentLine: 'rgba(167,139,250,0.08)',
    starColor: '167,139,250',
    waveOpacity: 0.06,
  },
];

function storageKey(userId?: string): string {
  return userId ? `flow_background_theme_${userId}` : 'flow_background_theme';
}

export function getBackgroundThemes(): BackgroundTheme[] {
  return THEMES;
}

export function getThemeById(id: string): BackgroundTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export function getStoredTheme(userId?: string): BackgroundTheme {
  try {
    const stored = localStorage.getItem(storageKey(userId));
    if (stored) return getThemeById(stored);
  } catch { /* ignore */ }
  return THEMES[0];
}

export function storeTheme(id: string, userId?: string): void {
  try {
    localStorage.setItem(storageKey(userId), id);
  } catch { /* ignore */ }
}
