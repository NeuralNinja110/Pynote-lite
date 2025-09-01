export type ThemeColor = 'black' | 'pink' | 'red' | 'green' | 'purple' | 'blue' | 'yellow';
export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  mode: ThemeMode;
  color: ThemeColor;
}

export const themeColors: Record<ThemeColor, { primary: string; accent: string }> = {
  black: { primary: 'hsl(0 0% 9%)', accent: 'hsl(0 0% 25%)' },
  pink: { primary: 'hsl(330 81% 60%)', accent: 'hsl(330 81% 70%)' },
  red: { primary: 'hsl(0 84% 60%)', accent: 'hsl(0 84% 70%)' },
  green: { primary: 'hsl(142 71% 45%)', accent: 'hsl(142 71% 55%)' },
  purple: { primary: 'hsl(262 83% 58%)', accent: 'hsl(262 83% 68%)' },
  blue: { primary: 'hsl(221 83% 53%)', accent: 'hsl(221 83% 63%)' },
  yellow: { primary: 'hsl(47 96% 53%)', accent: 'hsl(47 96% 63%)' },
};

export function applyTheme(theme: ThemeState) {
  const root = document.documentElement;
  
  // Apply theme mode
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Apply theme color
  root.className = root.className.replace(/theme-\w+/g, '');
  root.classList.add(`theme-${theme.color}`);
  
  // Update CSS custom properties
  const colors = themeColors[theme.color];
  root.style.setProperty('--theme-primary', colors.primary);
  root.style.setProperty('--theme-accent', colors.accent);
}

export function saveTheme(theme: ThemeState) {
  localStorage.setItem('pynote-theme', JSON.stringify(theme));
}

export function loadTheme(): ThemeState {
  try {
    const stored = localStorage.getItem('pynote-theme');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage');
  }
  
  return { mode: 'light', color: 'blue' };
}
