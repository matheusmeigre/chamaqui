// ----------------------------------------------------------------------------
// Relógio de SLA em horas úteis
//
// Atendimento em dias úteis, 9h–18h, no fuso de operação (America/Sao_Paulo),
// com exclusão de fins de semana e do calendário de feriados (nacionais,
// estaduais de MG e municipais das três cidades atendidas).
//
// Toda a aritmética é feita em "hora de parede": o instante UTC é deslocado
// para o fuso de operação, as contas usam os getters UTC do Date deslocado, e
// o resultado é convertido de volta para UTC no final.
// ----------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import {
  BUSINESS_DAY_END_HOUR,
  BUSINESS_DAY_START_HOUR,
} from "@/server/domain/ticket-grid";

export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Trava de segurança: nenhum prazo do contrato chega perto disso. */
const MAX_DAY_ITERATIONS = 2000;

/** Datas de feriado no formato YYYY-MM-DD, na hora de parede do fuso. */
export type BusinessCalendar = {
  holidays: ReadonlySet<string>;
};

export const EMPTY_CALENDAR: BusinessCalendar = { holidays: new Set() };

// ----------------------------------------------------------------------------
// Conversão de fuso sem dependência externa
// ----------------------------------------------------------------------------

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Deslocamento do fuso de operação em relação ao UTC, no instante informado.
 * Resolvido pelo Intl para continuar correto caso as regras do fuso mudem.
 */
function zoneOffsetMs(date: Date): number {
  const parts = zonedFormatter.formatToParts(date);
  const field: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") field[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    field.year,
    field.month - 1,
    field.day,
    field.hour % 24,
    field.minute,
    field.second,
  );
  // Zera os milissegundos dos dois lados para isolar o deslocamento.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC → hora de parede (os getters UTC do retorno leem a hora local). */
function toWallClock(date: Date): Date {
  return new Date(date.getTime() + zoneOffsetMs(date));
}

/** Hora de parede → UTC. */
function fromWallClock(wall: Date): Date {
  // O deslocamento é estável no horizonte de um prazo de SLA (o Brasil não
  // adota horário de verão desde 2019), então uma aproximação basta.
  const approx = new Date(wall.getTime() - zoneOffsetMs(wall));
  return new Date(wall.getTime() - zoneOffsetMs(approx));
}

/** Chave YYYY-MM-DD de um Date já em hora de parede. */
function wallDateKey(wall: Date): string {
  const y = wall.getUTCFullYear();
  const m = String(wall.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wall.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Meia-noite (hora de parede) do dia do instante informado. */
function startOfWallDay(wall: Date): Date {
  return new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()),
  );
}

function wallDayWindow(dayStart: Date): { open: Date; close: Date } {
  return {
    open: new Date(dayStart.getTime() + BUSINESS_DAY_START_HOUR * MS_PER_HOUR),
    close: new Date(dayStart.getTime() + BUSINESS_DAY_END_HOUR * MS_PER_HOUR),
  };
}

function isBusinessDay(dayStart: Date, calendar: BusinessCalendar): boolean {
  const weekday = dayStart.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !calendar.holidays.has(wallDateKey(dayStart));
}

// ----------------------------------------------------------------------------
// Operações do relógio
// ----------------------------------------------------------------------------

/**
 * Horas úteis decorridas entre dois instantes. Tempo fora da janela 9h–18h,
 * em fim de semana ou feriado não conta.
 */
export function businessHoursBetween(
  from: Date,
  to: Date,
  calendar: BusinessCalendar = EMPTY_CALENDAR,
): number {
  if (to.getTime() <= from.getTime()) return 0;

  const wallFrom = toWallClock(from);
  const wallTo = toWallClock(to);

  let total = 0;
  let dayStart = startOfWallDay(wallFrom);
  let guard = 0;

  while (dayStart.getTime() <= wallTo.getTime() && guard++ < MAX_DAY_ITERATIONS) {
    if (isBusinessDay(dayStart, calendar)) {
      const { open, close } = wallDayWindow(dayStart);
      const start = Math.max(wallFrom.getTime(), open.getTime());
      const end = Math.min(wallTo.getTime(), close.getTime());
      if (end > start) total += (end - start) / MS_PER_HOUR;
    }
    dayStart = new Date(dayStart.getTime() + MS_PER_DAY);
  }

  return Number(total.toFixed(4));
}

/**
 * Soma horas úteis a um instante, devolvendo o prazo em UTC. Se o início cair
 * fora da janela de atendimento, o relógio começa na próxima abertura.
 */
export function addBusinessHours(
  start: Date,
  hours: number,
  calendar: BusinessCalendar = EMPTY_CALENDAR,
): Date {
  const wallStart = toWallClock(start);
  let remaining = hours;
  let dayStart = startOfWallDay(wallStart);
  let cursor = wallStart.getTime();
  let guard = 0;

  while (guard++ < MAX_DAY_ITERATIONS) {
    if (isBusinessDay(dayStart, calendar)) {
      const { open, close } = wallDayWindow(dayStart);
      const from = Math.max(cursor, open.getTime());

      if (close.getTime() > from) {
        const availableHours = (close.getTime() - from) / MS_PER_HOUR;

        // `<=` para que um prazo que consome o dia exato feche às 18h, em vez
        // de escorregar para a abertura do dia seguinte.
        if (remaining <= availableHours) {
          return fromWallClock(new Date(from + remaining * MS_PER_HOUR));
        }
        remaining -= availableHours;
      }
    }

    dayStart = new Date(dayStart.getTime() + MS_PER_DAY);
    cursor = dayStart.getTime();
  }

  throw new Error(
    `Prazo em horas úteis não convergiu em ${MAX_DAY_ITERATIONS} dias (horas=${hours}).`,
  );
}

/** Soma dias úteis inteiros — usado no prazo de contestação de categoria. */
export function addBusinessDays(
  start: Date,
  days: number,
  calendar: BusinessCalendar = EMPTY_CALENDAR,
): Date {
  let dayStart = startOfWallDay(toWallClock(start));
  let remaining = days;
  let guard = 0;

  while (remaining > 0 && guard++ < MAX_DAY_ITERATIONS) {
    dayStart = new Date(dayStart.getTime() + MS_PER_DAY);
    if (isBusinessDay(dayStart, calendar)) remaining -= 1;
  }

  // O prazo vence no fechamento do expediente do último dia útil.
  return fromWallClock(wallDayWindow(dayStart).close);
}

// ----------------------------------------------------------------------------
// Carregamento do calendário de feriados
// ----------------------------------------------------------------------------

type CachedCalendar = { calendar: BusinessCalendar; loadedAt: number };

const CALENDAR_TTL_MS = 10 * 60 * 1000;
let cache: CachedCalendar | null = null;

/**
 * Carrega o calendário de feriados do banco, com cache curto em memória — os
 * feriados mudam uma vez por ano e o relógio é consultado a cada chamado.
 */
export async function loadBusinessCalendar(): Promise<BusinessCalendar> {
  if (cache && Date.now() - cache.loadedAt < CALENDAR_TTL_MS) {
    return cache.calendar;
  }

  const rows = await prisma.holiday.findMany({ select: { date: true } });
  const holidays = new Set<string>();
  for (const row of rows) {
    // A coluna é DATE: o driver devolve meia-noite UTC, que já é a data de
    // parede pretendida — converter de fuso aqui deslocaria o feriado em um dia.
    holidays.add(wallDateKey(row.date));
  }

  const calendar: BusinessCalendar = { holidays };
  cache = { calendar, loadedAt: Date.now() };
  return calendar;
}

/** Invalida o cache — usado após alterações no calendário. */
export function invalidateBusinessCalendarCache(): void {
  cache = null;
}

export const __testing = { toWallClock, fromWallClock, wallDateKey, isBusinessDay };
