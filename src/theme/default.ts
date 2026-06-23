/**
 * Default theme configuration
 * Customize these values to match your app's design
 */
export const defaultTheme = {
  colors: {
    background: '#142314',
    surface: '#1a2a1a',
    primary: '#5C8C66',
    secondary: '#C8923C',
    text: {
      primary: '#2E251F',
      muted: '#5C5444',
    },
    border: 'rgba(120, 95, 70, 0.18)',
    error: '#B5654A',
    success: '#5C8C66',
    warning: '#C8923C',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  animation: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 48,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;
