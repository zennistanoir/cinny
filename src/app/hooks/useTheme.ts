import { lightTheme } from 'folds';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onDarkFontWeight, onLightFontWeight } from '../../config.css';
import {
  amoledTheme,
  butterTheme,
  darkTheme,
  emeraldTheme,
  lavenderTheme,
  midnightTheme,
  roseTheme,
  silverTheme,
  violetTheme,
} from '../../colors.css';
import { settingsAtom } from '../state/settings';
import { useSetting } from '../state/hooks/settings';

export enum ThemeKind {
  Light = 'light',
  Dark = 'dark',
}

export type Theme = {
  id: string;
  kind: ThemeKind;
  classNames: string[];
};

export const LightTheme: Theme = {
  id: 'light-theme',
  kind: ThemeKind.Light,
  classNames: [lightTheme, onLightFontWeight, 'prism-light'],
};

export const SilverTheme: Theme = {
  id: 'silver-theme',
  kind: ThemeKind.Light,
  classNames: ['silver-theme', silverTheme, onLightFontWeight, 'prism-light'],
};
export const DarkTheme: Theme = {
  id: 'dark-theme',
  kind: ThemeKind.Dark,
  classNames: ['dark-theme', darkTheme, onDarkFontWeight, 'prism-dark'],
};
export const ButterTheme: Theme = {
  id: 'butter-theme',
  kind: ThemeKind.Dark,
  classNames: ['butter-theme', butterTheme, onDarkFontWeight, 'prism-dark'],
};

export const VioletTheme: Theme = {
  id: 'violet-theme',
  kind: ThemeKind.Dark,
  classNames: ['violet-theme', violetTheme, onDarkFontWeight, 'prism-dark'],
};

export const LavenderTheme: Theme = {
  id: 'lavender-theme',
  kind: ThemeKind.Light,
  classNames: ['lavender-theme', lavenderTheme, onLightFontWeight, 'prism-light'],
};

export const MidnightTheme: Theme = {
  id: 'midnight-theme',
  kind: ThemeKind.Dark,
  classNames: ['midnight-theme', midnightTheme, onDarkFontWeight, 'prism-dark'],
};

export const EmeraldTheme: Theme = {
  id: 'emerald-theme',
  kind: ThemeKind.Dark,
  classNames: ['emerald-theme', emeraldTheme, onDarkFontWeight, 'prism-dark'],
};

export const RoseTheme: Theme = {
  id: 'rose-theme',
  kind: ThemeKind.Dark,
  classNames: ['rose-theme', roseTheme, onDarkFontWeight, 'prism-dark'],
};

export const AmoledTheme: Theme = {
  id: 'amoled-theme',
  kind: ThemeKind.Dark,
  classNames: ['amoled-theme', amoledTheme, onDarkFontWeight, 'prism-dark'],
};

export const useThemes = (): Theme[] => {
  const themes: Theme[] = useMemo(
    () => [
      LightTheme,
      SilverTheme,
      LavenderTheme,
      DarkTheme,
      ButterTheme,
      VioletTheme,
      MidnightTheme,
      EmeraldTheme,
      RoseTheme,
      AmoledTheme,
    ],
    []
  );

  return themes;
};

export const useThemeNames = (): Record<string, string> =>
  useMemo(
    () => ({
      [LightTheme.id]: 'Light',
      [SilverTheme.id]: 'Silver',
      [DarkTheme.id]: 'Dark',
      [ButterTheme.id]: 'Butter',
      [VioletTheme.id]: 'Violet',
      [LavenderTheme.id]: 'Lavender',
      [MidnightTheme.id]: 'Midnight',
      [EmeraldTheme.id]: 'Emerald',
      [RoseTheme.id]: 'Rose',
      [AmoledTheme.id]: 'Black',
    }),
    []
  );

export const useSystemThemeKind = (): ThemeKind => {
  const darkModeQueryList = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);
  const [themeKind, setThemeKind] = useState<ThemeKind>(
    darkModeQueryList.matches ? ThemeKind.Dark : ThemeKind.Light
  );

  useEffect(() => {
    const handleMediaQueryChange = () => {
      setThemeKind(darkModeQueryList.matches ? ThemeKind.Dark : ThemeKind.Light);
    };

    darkModeQueryList.addEventListener('change', handleMediaQueryChange);
    return () => {
      darkModeQueryList.removeEventListener('change', handleMediaQueryChange);
    };
  }, [darkModeQueryList, setThemeKind]);

  return themeKind;
};

export const useActiveTheme = (): Theme => {
  const systemThemeKind = useSystemThemeKind();
  const themes = useThemes();
  const [systemTheme] = useSetting(settingsAtom, 'useSystemTheme');
  const [themeId] = useSetting(settingsAtom, 'themeId');
  const [lightThemeId] = useSetting(settingsAtom, 'lightThemeId');
  const [darkThemeId] = useSetting(settingsAtom, 'darkThemeId');

  if (!systemTheme) {
    const selectedTheme = themes.find((theme) => theme.id === themeId) ?? LightTheme;

    return selectedTheme;
  }

  const selectedTheme =
    systemThemeKind === ThemeKind.Dark
      ? themes.find((theme) => theme.id === darkThemeId) ?? DarkTheme
      : themes.find((theme) => theme.id === lightThemeId) ?? LightTheme;

  return selectedTheme;
};

const ThemeContext = createContext<Theme | null>(null);
export const ThemeContextProvider = ThemeContext.Provider;

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('No theme provided!');
  }

  return theme;
};
