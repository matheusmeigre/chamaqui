"use client";

import { DeviceIdBootstrap } from "./DeviceIdBootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DeviceIdBootstrap />
      {children}
    </>
  );
}
