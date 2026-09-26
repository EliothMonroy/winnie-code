import type { ComponentType, SVGProps } from "react";
import { setThemePreference, useThemePreference, type ThemePreference } from "../theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const OPTIONS: { value: ThemePreference; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "system", label: "Match system theme", Icon: MonitorIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
];

export function ThemeToggle() {
  const preference = useThemePreference();
  return (
    <div className="theme-toggle" role="group" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="theme-option"
          aria-pressed={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setThemePreference(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
