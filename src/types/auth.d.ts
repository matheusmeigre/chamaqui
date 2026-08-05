// Tipos do fluxo de autenticação por dispositivo

export type AuthRole = "SOLICITANTE" | "ADMINISTRADOR";

export type AuthSessionUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  organizationId: string | null;
  deviceId: string;
};
