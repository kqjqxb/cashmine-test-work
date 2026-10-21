import { Platform } from 'react-native';

// CashMine look: warm cream background, white cards, orange accents. Light theme only.
export const colors = {
  background: '#F4F0EB',
  /** Subtle warm page gradient. */
  backgroundTop: '#F6F2EE',
  backgroundBottom: '#F3EAE2',
  card: '#FFFFFF',
  border: '#E8E0D8',
  text: '#1A1714',
  textMuted: '#7A7068',
  accent: '#C0612B',
  brand: '#E8742C',
  gradientStart: '#F4A261',
  gradientEnd: '#E8742C',
  buttonShadow: 'rgba(232,116,44,0.25)',
  buttonText: '#1A1A1A',
  /** Highlighted card (like cashmine.io's event rows). */
  highlight: '#F8E9DE',
  highlightBorder: '#EDC4A8',
  skeleton: '#ECE5DD',
  positive: '#2E7D4F',
  positiveBackground: '#E6F4EA',
  danger: '#A8321E',
  dangerBackground: '#FBEAE5',
  warning: '#8A5A00',
  warningBackground: '#FFF3D6',
} as const;

/** Asset icon colors; unknown assets fall back to `colors.text`. */
export const assetColors: Record<string, string> = { USDT: '#26A17B', BTC: '#F7931A', ETH: '#627EEA' };

export const radius = { card: 18, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Content never gets wider than a phone, even on a desktop browser. */
export const maxContentWidth = 480;

export const fontFamily = Platform.select({
  web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});
