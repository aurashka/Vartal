import React from 'react';
import { useTheme } from './ThemeContext';
import { SunIcon, MoonIcon } from './common/Icons';

const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, color, setColor, colors } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="flex items-center gap-2 mr-2">
      <button onClick={toggleTheme} className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
        {theme === 'light' ? <MoonIcon className="w-5 h-5"/> : <SunIcon className="w-5 h-5"/>}
      </button>
      <div className="flex items-center gap-2">
        {(Object.keys(colors) as Array<keyof typeof colors>).map(name => {
          const colorData = colors[name];
          return (
            <button
                key={name}
                onClick={() => setColor(name)}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === name ? 'ring-2 ring-offset-2 ring-primary dark:ring-offset-gray-800' : ''}`}
                style={{ backgroundColor: `hsl(${colorData.hue}, ${colorData.saturation}%, ${colorData.lightness}%)` }}
                aria-label={`Set theme color to ${String(name)}`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
