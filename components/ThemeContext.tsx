import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

type Theme = 'light' | 'dark';
type ColorName = 'blue' | 'green' | 'purple' | 'red' | 'orange';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  color: ColorName;
  setColor: (color: ColorName) => void;
  colors: Record<ColorName, { hue: number; saturation: number; lightness: number; }>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_COLORS: Record<ColorName, { hue: number; saturation: number; lightness: number; }> = {
    blue: { hue: 221, saturation: 83, lightness: 53 },
    green: { hue: 145, saturation: 63, lightness: 49 },
    purple: { hue: 262, saturation: 83, lightness: 64 },
    red: { hue: 0, saturation: 84, lightness: 60 },
    orange: { hue: 25, saturation: 95, lightness: 53 },
};


export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [color, setColorState] = useState<ColorName>('blue');

  useEffect(() => {
    const savedTheme = localStorage.getItem('chat-theme') as Theme;
    const savedColor = localStorage.getItem('chat-color') as ColorName;
    
    if (savedTheme) {
      setThemeState(savedTheme);
    } else {
      setThemeState('light');
    }

    if (savedColor && THEME_COLORS[savedColor]) {
      setColorState(savedColor);
    }

  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('chat-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const { hue, saturation, lightness } = THEME_COLORS[color];
    root.style.setProperty('--color-primary-hue', hue.toString());
    root.style.setProperty('--color-primary-saturation', `${saturation}%`);
    root.style.setProperty('--color-primary-lightness', `${lightness}%`);
    localStorage.setItem('chat-color', color);
  }, [color]);
  
  const setTheme = (newTheme: Theme) => {
      setThemeState(newTheme);
  };
  
  const setColor = (newColor: ColorName) => {
      setColorState(newColor);
  };

  const value = useMemo(() => ({
      theme,
      setTheme,
      color,
      setColor,
      colors: THEME_COLORS,
  }), [theme, color]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};