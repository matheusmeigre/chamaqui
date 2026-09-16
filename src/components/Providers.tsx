"use client";

import { DeviceIdBootstrap } from "./DeviceIdBootstrap";
import { ThemeProvider } from "./theme/ThemeProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DeviceIdBootstrap />
      {children}
    </ThemeProvider>
  );
}
