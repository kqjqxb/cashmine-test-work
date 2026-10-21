import { Platform } from 'react-native';

// CashMine look: warm cream background, white cards, orange accents. Light theme only.
export const colors = {
  background: '#F4F0EB',
  card: '#FFFFFF',
  border: '#E8E0D8',
  text: '#1A1714',
  textMuted: '#7A7068',
  accent: '#C0612B',
  gradientStart: '#F2A766',
  gradientEnd: '#E07A3A',
  buttonText: '#1A1714',
  skeleton: '#ECE5DD',
  danger: '#A8321E',
  dangerBackground: '#FBEAE5',
  warning: '#8A5A00',
  warningBackground: '#FFF3D6',
} as const;

export const radius = { card: 18, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Content never gets wider than a phone, even on a desktop browser. */
export const maxContentWidth = 480;

export const fontFamily = Platform.select({
  web: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  default: undefined,
});
