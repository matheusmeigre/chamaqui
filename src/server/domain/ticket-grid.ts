// ----------------------------------------------------------------------------
// Grade de Chamados — fonte única de verdade do modelo contratual
//
// Três eixos independentes (ver documento de contexto, seção 3):
//   - Natureza (categoria C1..C6) → define quem paga e o que tem teto
//   - Severidade (P1..P4)         → define SLA de resposta e solução
//   - Esforço (horas)             → converte chamado em capacidade
//
// O teto se aplica somente ao eixo de natureza. Severidade nunca tem teto.
// ----------------------------------------------------------------------------

import type { ContractTier, Priority, QuotaUnit, Severity, TicketCategoryCode } from "@prisma/client";

/** Uma jornada útil: 9h às 18h = 9 horas de relógio de SLA. */
export const BUSINESS_HOURS_PER_DAY = 9;
export const BUSINESS_DAY_START_HOUR = 9;
export const BUSINESS_DAY_END_HOUR = 18;

/** Converte dias úteis em horas úteis, a unidade interna do relógio de SLA. */
export function businessDays(days: number): number {
  return days * BUSINESS_HOURS_PER_DAY;
}

// ----------------------------------------------------------------------------
// Eixo 1 — Natureza (categorias C1..C6)
// ----------------------------------------------------------------------------

export type CategoryDefinition = {
  code: TicketCategoryCode;
  label: string;
  description: string;
  /** Unidade em que o teto é contado. */
  unit: QuotaUnit;
  /** Rótulo da unidade, para a interface. */
  unitLabel: { one: string; many: string };
  /** C1 é garantia e não tem teto; C5 está fora do contrato. */
  hasQuota: boolean;
  /** C5 não é atendido pela mensalidade — vai a orçamento. */
  inContract: boolean;
  /** Severidade P1..P4 só existe em C1. */
  requiresSeverity: boolean;
  /** Esforço médio por unidade, usado no dimensionamento da grade. */
  averageEffortHours: number;
};

export const CATEGORY_DEFINITIONS: Record<TicketCategoryCode, CategoryDefinition> = {
  C1: {
    code: "C1",
    label: "Incidente / correção",
    description:
      "App não faz o que a documentação diz: captura não valida no raio de 150 m, download offline interrompe, entrada sem rede falha com sessão salva, crash ou ANR no Play Console.",
    unit: "CHAMADO",
    unitLabel: { one: "chamado", many: "chamados" },
    hasQuota: false,
    inContract: true,
    requiresSeverity: true,
    averageEffortHours: 3.0,
  },
  C2: {
    code: "C2",
    label: "Operação de conteúdo",
    description:
      "Atrativo, arte de medalha, áudio-guia, galeria, evento cultural, estabelecimento do Guia Local, Destaque VIP, cupom, blacklist de moderação.",
    unit: "ITEM",
    unitLabel: { one: "item", many: "itens" },
    hasQuota: true,
    inContract: true,
    requiresSeverity: false,
    averageEffortHours: 0.5,
  },
  C3: {
    code: "C3",
    label: "Suporte",
    description:
      "Reset de senha, exclusão de conta, chamado do tipo “fui ao local e não capturei”, dúvida de uso, orientação à equipe, treinamento.",
    unit: "ATENDIMENTO",
    unitLabel: { one: "atendimento", many: "atendimentos" },
    hasQuota: true,
    inContract: true,
    requiresSeverity: false,
    averageEffortHours: 0.3,
  },
  C4: {
    code: "C4",
    label: "Ajuste evolutivo",
    description:
      "Texto, cor, ícone, ordem de aba, filtro, campo, layout — até 8 h por chamado. Acima disso é reclassificado como C5.",
    unit: "CHAMADO",
    unitLabel: { one: "chamado", many: "chamados" },
    hasQuota: true,
    inContract: true,
    requiresSeverity: false,
    averageEffortHours: 3.0,
  },
  C5: {
    code: "C5",
    label: "Evolutivo estruturante",
    description:
      "Nova funcionalidade, nova cidade/rota, nova integração, redesenho, nova plataforma. Fora do contrato de sustentação — vai a orçamento com aceite formal.",
    unit: "PROJETO",
    unitLabel: { one: "projeto", many: "projetos" },
    hasQuota: false,
    inContract: false,
    requiresSeverity: false,
    averageEffortHours: 0,
  },
  C6: {
    code: "C6",
    label: "Plataforma",
    description:
      "Build e publicação na Play, migration em produção, rotação de chave, quota do Google Maps, allow list do Supabase, conformidade anual de target SDK.",
    unit: "EVENTO",
    unitLabel: { one: "evento", many: "eventos" },
    hasQuota: true,
    inContract: true,
    requiresSeverity: false,
    averageEffortHours: 4.0,
  },
};

export const CATEGORY_ORDER: TicketCategoryCode[] = ["C1", "C2", "C3", "C4", "C5", "C6"];

/** Fronteira C4/C5: um número de horas, não um adjetivo. */
export const C4_MAX_EFFORT_HOURS = 8;

/** Reabertura dentro desta janela é o mesmo chamado e não consome teto novo. */
export const REOPEN_WINDOW_DAYS = 15;

/** Prazo do cliente para contestar a categoria atribuída na abertura. */
export const CONTESTATION_WINDOW_BUSINESS_DAYS = 5;

// ----------------------------------------------------------------------------
// Eixo 2 — Severidade (P1..P4), aplicável somente a C1
// ----------------------------------------------------------------------------

export type SeverityDefinition = {
  code: Severity;
  label: string;
  description: string;
  /** Prazos em horas úteis (9h–18h, dias úteis). */
  firstResponseHours: number;
  /** null quando não se aplica (P3/P4 não têm compromisso de contorno). */
  workaroundHours: number | null;
  /** null em P4: a correção sai na próxima release. */
  definitiveFixHours: number | null;
};

export const SEVERITY_DEFINITIONS: Record<Severity, SeverityDefinition> = {
  P1: {
    code: "P1",
    label: "Crítico",
    description:
      "App não abre, autenticação fora do ar, captura falha em todos os atrativos, exposição de dado pessoal.",
    firstResponseHours: 2,
    workaroundHours: 8,
    definitiveFixHours: 48,
  },
  P2: {
    code: "P2",
    label: "Alto",
    description:
      "Função central degradada para muitos: download offline, Guia Local sem carregar, medalha que não desbloqueia.",
    firstResponseHours: 4,
    workaroundHours: businessDays(2),
    definitiveFixHours: businessDays(5),
  },
  P3: {
    code: "P3",
    label: "Médio",
    description:
      "Defeito localizado com contorno disponível: imagem trocada, texto incorreto, Health Connect sem dados em um modelo.",
    firstResponseHours: businessDays(1),
    workaroundHours: null,
    definitiveFixHours: businessDays(5),
  },
  P4: {
    code: "P4",
    label: "Baixo",
    description: "Cosmético, sem impacto no uso.",
    firstResponseHours: businessDays(2),
    workaroundHours: null,
    definitiveFixHours: null,
  },
};

export const SEVERITY_ORDER: Severity[] = ["P1", "P2", "P3", "P4"];

/**
 * Mapeia severidade para a prioridade legada, mantendo listagens e dashboard
 * coerentes sem duplicar a decisão de classificação.
 */
export const SEVERITY_TO_PRIORITY = {
  P1: "CRITICA",
  P2: "ALTA",
  P3: "MEDIA",
  P4: "BAIXA",
} as const;

/**
 * O caminho inverso, para comunicar em P1..P4 um chamado que não é C1 e por
 * isso não tem severidade. Não classifica nada: só traduz a escala.
 */
export const PRIORITY_TO_SEVERITY = {
  CRITICA: "P1",
  ALTA: "P2",
  MEDIA: "P3",
  BAIXA: "P4",
} as const satisfies Record<Priority, Severity>;

// ----------------------------------------------------------------------------
// Eixo 3 — Faixas de contratação e tetos
// ----------------------------------------------------------------------------

export type TierDefinition = {
  tier: ContractTier;
  label: string;
  /** Capacidade contratada em horas por mês. */
  capacityHours: number;
  /** Reserva de C1: a categoria não tem teto, mas tem reserva de capacidade. */
  c1ReserveHours: number;
  /** Parcela da reserva de C1 destinada a P1 — metade, por dimensionamento. */
  p1ReserveHours: number;
  /** Teto de P1 sustentados em mês de crise. */
  p1CrisisCeiling: number;
  /** Tetos mensais por categoria, na unidade de cada uma. null = sem teto. */
  quotas: Record<TicketCategoryCode, number | null>;
};

export const TIER_DEFINITIONS: Record<ContractTier, TierDefinition> = {
  ESSENCIAL: {
    tier: "ESSENCIAL",
    label: "Essencial",
    capacityHours: 40,
    c1ReserveHours: 10,
    p1ReserveHours: 5,
    p1CrisisCeiling: 1,
    quotas: { C1: null, C2: 20, C3: 20, C4: 3, C5: null, C6: 1 },
  },
  PADRAO: {
    tier: "PADRAO",
    label: "Padrão",
    capacityHours: 80,
    c1ReserveHours: 20,
    p1ReserveHours: 10,
    p1CrisisCeiling: 2,
    quotas: { C1: null, C2: 40, C3: 40, C4: 6, C5: null, C6: 2 },
  },
  AMPLIADO: {
    tier: "AMPLIADO",
    label: "Ampliado",
    capacityHours: 160,
    c1ReserveHours: 40,
    p1ReserveHours: 20,
    p1CrisisCeiling: 3,
    quotas: { C1: null, C2: 80, C3: 80, C4: 12, C5: null, C6: 4 },
  },
};

export const TIER_ORDER: ContractTier[] = ["ESSENCIAL", "PADRAO", "AMPLIADO"];

/** Aviso automático quando o consumo atinge esta fração do teto. */
export const QUOTA_WARNING_THRESHOLD = 0.8;

/** Antecipação permitida do teto do mês seguinte (uma vez por trimestre). */
export const QUOTA_ADVANCE_MAX_RATIO = 0.2;

/** Limite de rajada: um terceiro P1 na mesma semana zera C2/C3/C4 do mês. */
export const P1_BURST_ALERT_THRESHOLD = 2;
export const P1_BURST_CRITICAL_THRESHOLD = 3;

/** Categorias cujos tetos são zerados quando a rajada crítica de P1 dispara. */
export const BURST_ZEROED_CATEGORIES: TicketCategoryCode[] = ["C2", "C3", "C4"];
