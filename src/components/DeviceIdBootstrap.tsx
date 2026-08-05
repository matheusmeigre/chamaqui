"use client";

import { useEffect } from "react";

// ----------------------------------------------------------------------------
// Garante que o navegador possua um ID de dispositivo persistente.
// O cookie é acessível ao servidor (sem HttpOnly) e participa do fingerprint,
// permitindo o device binding. Sem ele, o servidor não reconhece o dispositivo.
// ----------------------------------------------------------------------------

const COOKIE_NAME = "chq_client_device_id";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 ano

function generateClientDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function hasCookie(name: string) {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${name}=`));
}

export function DeviceIdBootstrap() {
  useEffect(() => {
    try {
      if (!hasCookie(COOKIE_NAME)) {
        const value = generateClientDeviceId();
        document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      }
    } catch {
      // cookie bloqueado; o servidor usará "unknown-client"
    }
  }, []);

  return null;
}
