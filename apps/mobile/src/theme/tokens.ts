export const colors = {
  primary: "#0066CC",
  primaryDark: "#0052A3",
  secondary: "#FF6600",
  background: "#F5F5F5",
  foreground: "#1A1A1A",
  muted: "#6B7280",
  border: "#E5E7EB",
  card: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#2563EB",
  white: "#FFFFFF",
  overlay: "rgba(26, 26, 26, 0.08)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 999,
} as const;

export const typography = {
  title: 28,
  subtitle: 20,
  body: 16,
  caption: 13,
  overline: 12,
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },
} as const;
