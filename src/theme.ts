export interface ThemePalette {
  background: string;
  surface: string;
  card: string;
  textMain: string;
  textSub: string;
  primary: string;
  primaryHover: string;
  accent: string;
  accentHover: string;
  border: string;

  // Anwesenheit (Attendance)
  attendanceBox: string;
  attendanceText: string;
  attendanceLegendPresent: string;
  attendanceLegendExcused: string;
  attendanceLegendUnexcused: string;
  attendanceLegendPrivate: string;
  attendanceLegendSick: string;
  attendanceLegendInjured: string;

  // Erweiterbar für zukünftige Farbwerte
  [key: string]: string;
}

export type ThemeMode = 'dark' | 'light';

export const darkTheme: ThemePalette = {
  background: "#0A0E17",
  surface: "#1A1A1A",
  card: "#121824",
  textMain: "#F8FAFC",
  textSub: "#94A3B8",
  primary: "#10B981",
  primaryHover: "#059669",
  accent: "#F59E0B",
  accentHover: "#FBBF24",
  border: "#2A2A2A",

  // Anwesenheit (Dark Mode: Angenehme, natürliche Farbkästen, schwarze Schrift #000000)
  attendanceBox: "#A7F3D0",
  attendanceText: "#000000",
  attendanceLegendPresent: "#A7F3D0",
  attendanceLegendExcused: "#BFDBFE",
  attendanceLegendUnexcused: "#FECACA",
  attendanceLegendPrivate: "#DDD6FE",
  attendanceLegendSick: "#FEF08A",
  attendanceLegendInjured: "#FECDD3"
};

export const lightTheme: ThemePalette = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  card: "#F0F2F5",
  textMain: "#0A0A0A",
  textSub: "#4A4A4A",
  primary: "#0D9488",
  primaryHover: "#0F766E",
  accent: "#D97706",
  accentHover: "#EA8A0C",
  border: "#D1D5DB",

  // Anwesenheit (Light Mode: Angenehme, natürliche Farbkästen, schwarze Schrift #000000)
  attendanceBox: "#A7F3D0",
  attendanceText: "#000000",
  attendanceLegendPresent: "#A7F3D0",
  attendanceLegendExcused: "#BFDBFE",
  attendanceLegendUnexcused: "#FECACA",
  attendanceLegendPrivate: "#DDD6FE",
  attendanceLegendSick: "#FEF08A",
  attendanceLegendInjured: "#FECDD3"
};

/**
 * Erweiterbare Theme-Registrierung
 */
export const themes: Record<string, ThemePalette> = {
  dark: darkTheme,
  light: lightTheme
};

/**
 * getTheme(mode)
 * @param mode "dark" oder "light"
 * @returns Gibt das passende Theme-Objekt zurück
 */
export function getTheme(mode: ThemeMode | string = 'dark'): ThemePalette {
  return themes[mode] || darkTheme;
}

/**
 * getColor(mode, name)
 * @param mode "dark" oder "light"
 * @param name Schlüsselname der Farbe (z.B. "background", "primary", "attendanceBox")
 * @returns Gibt eine einzelne Farbe aus dem gewählten Theme zurück
 */
export function getColor(mode: ThemeMode | string, name: keyof ThemePalette | string): string {
  const theme = getTheme(mode);
  return theme[name] || '';
}

/**
 * getAllColors(mode)
 * @param mode "dark" oder "light"
 * @returns Gibt alle Farben des Themes als Objekt/JSON-Kopie zurück
 */
export function getAllColors(mode: ThemeMode | string): ThemePalette {
  return { ...getTheme(mode) };
}

/**
 * Hilfsfunktion zum Registrieren weiterer Theme-Varianten (Erweiterbarkeit)
 */
export function registerTheme(name: string, palette: ThemePalette): void {
  themes[name] = palette;
}

