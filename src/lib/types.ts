import { Accessor, ParentComponent, Setter } from "solid-js";

export type Styles = { [className: string]: string };

export type ThemeConfig = {
  icon: string;
  browser_theme_color: string;
};

export type ThemeVars = {
  [key: string]: string;
};

export type ThemeObject = {
  config: ThemeConfig;
  vars: ThemeVars;
};

export type SystemThemesObject = {
  dark: string;
  light: string;
};

export type ThemesObject = {
  [key: string]: ThemeObject;
};

export type ThemesConfigObject = {
  system_theme_config: SystemThemesObject;
  themes: ThemesObject;
};

export interface ThemeProviderProps {
  calculate_variants?: (value: string, variable: string) => ThemeVars;
  default?: string;
  id?: string;
  name?: string
  label?: string;
  prefix?: string;
  styles?: Styles;
  themes?: ThemesConfigObject;
  menu_placement?: "ne" | "se" | "sw" | "nw";
  updateTheme?: (value: string) => void | Setter<string>;
  theme?: Accessor<string> | string;
}
