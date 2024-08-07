import {
  ParentComponent,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  mergeProps,
  useContext,
} from "solid-js";
import fallbackThemes from "./fallbacks.themes.json";
import { SystemThemesObject, ThemeObject, ThemeProviderProps, ThemesObject } from "./lib/types";
import { SYSTEM_THEME_CONFIG_KEY, SYSTEM_THEME_KEY } from "./lib/constants";
import { makePersisted } from "@solid-primitives/storage";

interface ThemeState {
  get theme(): string;
  setTheme(value: string): void;
  get themeObject(): ThemeObject;
}

const ThemeContext = createContext({} as ThemeState);

export const useThemeContext = () => useContext(ThemeContext);

const calculate_variants = (name: string, value: string) => {
  //if the current value is a hex color - add complementary transparencies
  let pattern = /^#[0-9A-F]{6}$/i;
  if (value.match(pattern)) {
    return {
      [name + "-alpha_primary"]: value + "f2", // 95%
      [name + "-alpha_secondary"]: value + "99", // 60%
      [name + "-alpha_tertiary"]: value + "4d", // 30%
      [name + "-alpha_quaternary"]: value + "17", // 9%
      // allow for mispelled 'quarternary' for backwards compatibility
      [name + "-alpha_quarternary"]: value + "17", // 9%
    };
  }
  return {};
};

export const ThemeProvider: ParentComponent<ThemeProviderProps> = props => {
  const [currentTheme, setTheme] = makePersisted(createSignal<string | null>(null), {
    name: props.name ?? "theme",
  });

  const values = mergeProps({ theme: currentTheme, setTheme: setTheme }, props);

  const theme = createMemo(() =>
    typeof values.theme === "function" ? values.theme() : values.theme
  );

  const prefix = values.prefix || "stp-";
  const system_theme_config: SystemThemesObject =
    values.themes?.system_theme_config || fallbackThemes.system_theme_config;
  const themes: ThemesObject = values.themes?.themes || fallbackThemes.themes;
  const themeKeys = Object.keys(themes);
  const hasSystemThemesObject =
    values.themes && values.themes.hasOwnProperty(SYSTEM_THEME_CONFIG_KEY);
  const systemThemesCorrect =
    hasSystemThemesObject &&
    system_theme_config.hasOwnProperty("dark") &&
    system_theme_config.hasOwnProperty("light") &&
    themes.hasOwnProperty(system_theme_config.dark) &&
    themes.hasOwnProperty(system_theme_config.light);
  const custom_variants = values.calculate_variants || calculate_variants;

  const [useSystem, setUseSystem] = createSignal(
    values.default ? false : systemThemesCorrect ? true : false
  );

  const systemThemeIsDark = window.matchMedia("(prefers-color-scheme: dark)");
  // initialize the current theme
  createEffect(() => {
    if (theme()) return;
    values.setTheme(
      values.default ||
        (systemThemesCorrect
          ? systemThemeIsDark.matches
            ? system_theme_config.dark
            : system_theme_config.light
          : themeKeys[0])
    );
  });

  // otherTheme is used when the button is in toggle mode (only two themes configured)
  const [otherTheme, setOtherTheme] = createSignal(
    systemThemesCorrect
      ? values.default
        ? values.default == system_theme_config.dark
          ? system_theme_config.light
          : system_theme_config.dark
        : systemThemeIsDark.matches
          ? system_theme_config.light
          : system_theme_config.dark
      : themeKeys[1]
  );
  const [currentSystem, setCurrentSystem] = createSignal(
    systemThemesCorrect
      ? systemThemeIsDark.matches
        ? system_theme_config.dark
        : system_theme_config.light
      : themeKeys[0]
  );

  systemThemeIsDark.addEventListener("change", e => {
    if (systemThemesCorrect) {
      if (useSystem()) {
        let nextTheme = system_theme_config.light;
        if (e.matches) {
          nextTheme = system_theme_config.dark;
        }
        setOtherTheme(theme() as string);
        values.setTheme(nextTheme);
      }
      if (e.matches) {
        setCurrentSystem(system_theme_config.dark);
      } else {
        setCurrentSystem(system_theme_config.light);
      }
    }
  });

  // inject the invert stylesheet
  createEffect(() => {
    let stylesheet = document.createElement("style");
    stylesheet.type = "text/css";
    stylesheet.id = "stp-inverter";
    document.head.appendChild(stylesheet);
  });

  // check themes for proper config
  createEffect(() => {
    if (!systemThemesCorrect) {
      console.warn(
        `The '${SYSTEM_THEME_CONFIG_KEY}' property of your themes object is misconfigured. Automatic theme toggling may not work and the 'System Preference' dropdown option has been disabled`
      );
      if (!hasSystemThemesObject) {
        console.warn(`Your themes object is missing the '${SYSTEM_THEME_CONFIG_KEY}' property.`);
        if (!values.default) {
          console.warn(
            `Because you have omitted the '${SYSTEM_THEME_CONFIG_KEY}' object and have not provided a default theme via props; Theme toggling will utilize the first two themes in your themes object.`
          );
        }
      } else {
        if (!system_theme_config.hasOwnProperty("dark")) {
          console.warn("The 'system_themes.dark' property of your themes object is undefined.");
        } else if (!themes.hasOwnProperty(system_theme_config.dark)) {
          console.warn(
            `The 'system_themes.dark' property of your themes object is misconfigured. The theme '${system_theme_config.dark}' cannot be found.`
          );
        }
        if (!system_theme_config.hasOwnProperty("light")) {
          console.warn("The 'system_themes.light' property of your themes object is undefined.");
        } else if (!themes.hasOwnProperty(system_theme_config.light)) {
          console.warn(
            `The 'system_themes.light' property of your themes object is misconfigured. The theme '${system_theme_config.light}' cannot be found.`
          );
        }
      }
    }
    for (let [themeName, settings] of Object.entries(themes)) {
      if (!settings.hasOwnProperty("vars")) {
        console.warn(
          `The '${themeName}' object is missing its 'vars' property. It has been removed from the available themes`
        );
      } else if (!settings.hasOwnProperty("config")) {
        console.warn(`The '${themeName}' theme object is missing its 'config' property.`);
      }
    }
  });

  createEffect(() => {
    // TODO: loop through properties of last theme and remove any that don't exist in the next theme

    // loop through the theme vars and inject them to the :root style element
    if (!theme()) console.warn("Theme is null.");
    Object.keys(themes[theme() as string].vars).forEach(name => {
      document.documentElement.style.setProperty(
        "--" + prefix + name,
        themes[theme() as string].vars[name]
      );

      // calculate any variants and inject them to the :root style element
      let variants = custom_variants(name, themes[theme() as string].vars[name]);
      Object.keys(variants).forEach(variant => {
        document.documentElement.style.setProperty("--" + prefix + variant, variants[variant]);
      });
    });

    // find the theme-color meta tag and edit it, or, create a new one
    // <meta name="theme-color" content="#FFFFFF"></meta>
    let theme_meta = document.querySelector('meta[name="theme-color"]');
    if (
      themes[theme() as string].hasOwnProperty("config") &&
      themes[theme() as string].config.hasOwnProperty("browser_theme_color")
    ) {
      if (!theme_meta) {
        theme_meta = document.createElement("meta");
        theme_meta.setAttribute("name", "theme-color");
        document.getElementsByTagName("head")[0].appendChild(theme_meta);
      }
      theme_meta.setAttribute("content", themes[theme() as string].config.browser_theme_color);
    } else {
      if (theme_meta) theme_meta.remove();
    }

    // add the browser theme color as a css variable
    document.documentElement.style.setProperty(
      "--" + prefix + "browser_theme_color",
      themes[theme() as string].config.browser_theme_color
    );

    // find the stp-inverter stylesheet and edit it
    if (systemThemesCorrect) {
      let invertStylesheet = document.querySelector("#stp-inverter") as HTMLElement;
      if (invertStylesheet) {
        let currentlyDark = theme() == system_theme_config.dark;
        let currentlyLight = theme() == system_theme_config.light;

        if (currentlyDark) {
          invertStylesheet.innerText =
            'img[src$="#invert-safe--light"],.invert-safe--light{filter:hue-rotate(180deg) invert()}';
        } else if (currentlyLight) {
          invertStylesheet.innerText =
            'img[src$="#invert-safe--dark"],.invert-safe--dark{filter:hue-rotate(180deg) invert()}';
        }
      }
    }
  });

  function toggleTheme(nextTheme: string) {
    if (nextTheme == SYSTEM_THEME_KEY) {
      setUseSystem(true);
      values.setTheme(currentSystem());
    } else {
      setUseSystem(false);
      setOtherTheme(theme() as string);
      values.setTheme(nextTheme);
    }
  }

  const state: ThemeState = {
    get theme() {
      return theme() as string;
    },
    setTheme(value) {
      toggleTheme(value);
    },
    get themeObject() {
      return themes[theme() as string];
    },
  };

  return <ThemeContext.Provider value={state}>{props.children}</ThemeContext.Provider>;
};
