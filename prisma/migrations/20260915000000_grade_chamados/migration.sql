-- Grade de Chamados: eixos de natureza (C1..C6), severidade (P1..P4) e esforço,
-- contrato de sustentação com tetos por faixa, e calendário de feriados para o
-- relógio de SLA em horas úteis.

-- CreateEnum
CREATE TYPE "TicketCategoryCode" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "QuotaUnit" AS ENUM ('CHAMADO', 'ITEM', 'ATENDIMENTO', 'EVENTO', 'PROJETO');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('PORTAL', 'EMAIL', 'TELEFONE', 'PRESENCIAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "CorrectionClass" AS ENUM ('SERVIDOR', 'CLIENTE');

-- CreateEnum
CREATE TYPE "TicketOutcome" AS ENUM ('RESOLVIDO', 'IMPROCEDENTE_NAO_REPRODUZ', 'IMPROCEDENTE_ERRO_USO', 'IMPROCEDENTE_TERCEIRO', 'DUPLICADO', 'RECLASSIFICADO');

-- CreateEnum
CREATE TYPE "ContractTier" AS ENUM ('ESSENCIAL', 'PADRAO', 'AMPLIADO');

-- CreateEnum
CREATE TYPE "ContestationDecision" AS ENUM ('MANTIDA', 'ALTERADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "OverrunDecision" AS ENUM ('EXCEDENTE', 'FILA_PROXIMO_MES');

-- CreateEnum
CREATE TYPE "QuotaAdjustmentType" AS ENUM ('ANTECIPACAO', 'ZERAMENTO_RAJADA', 'MANUAL');

-- CreateEnum
CREATE TYPE "HolidayScope" AS ENUM ('NACIONAL', 'ESTADUAL', 'MUNICIPAL');

-- AlterTable
ALTER TABLE "Ticket"
    ADD COLUMN "categoryCode"          "TicketCategoryCode",
    ADD COLUMN "severity"              "Severity",
    ADD COLUMN "channel"               "TicketChannel" NOT NULL DEFAULT 'PORTAL',
    ADD COLUMN "openedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "firstResponseAt"       TIMESTAMP(3),
    ADD COLUMN "workaroundAt"          TIMESTAMP(3),
    ADD COLUMN "definitiveFixAt"       TIMESTAMP(3),
    ADD COLUMN "correctionClass"       "CorrectionClass",
    ADD COLUMN "sentToStoreAt"         TIMESTAMP(3),
    ADD COLUMN "storeApprovedAt"       TIMESTAMP(3),
    ADD COLUMN "units"                 INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "estimatedHours"        DOUBLE PRECISION,
    ADD COLUMN "actualHours"           DOUBLE PRECISION,
    ADD COLUMN "outcome"               "TicketOutcome",
    ADD COLUMN "consumesQuota"         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "competency"            TEXT,
    ADD COLUMN "parentTicketId"        TEXT,
    ADD COLUMN "contestationOpenedAt"  TIMESTAMP(3),
    ADD COLUMN "contestationDeadline"  TIMESTAMP(3),
    ADD COLUMN "contestationReason"    TEXT,
    ADD COLUMN "contestationDecision"  "ContestationDecision",
    ADD COLUMN "contestationDecidedAt" TIMESTAMP(3),
    ADD COLUMN "executionBlocked"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "overrunDecision"       "OverrunDecision",
    ADD COLUMN "overrunDecidedAt"      TIMESTAMP(3);

-- Backfill: os chamados anteriores à grade têm o marco zero do SLA e a
-- competência derivados da data de criação. A categoria C1..C6 permanece nula
-- de propósito — atribuí-la retroativamente seria um palpite, e o relatório
-- mensal precisa distinguir o que foi classificado sob a grade.
UPDATE "Ticket"
   SET "openedAt"   = "createdAt",
       "competency" = to_char("createdAt", 'YYYY-MM');

-- CreateTable
CREATE TABLE "SupportContract" (
    "id" TEXT NOT NULL,
    "tier" "ContractTier" NOT NULL DEFAULT 'PADRAO',
    "capacityHours" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractQuota" (
    "id" TEXT NOT NULL,
    "categoryCode" "TicketCategoryCode" NOT NULL,
    "unit" "QuotaUnit" NOT NULL,
    "monthlyLimit" INTEGER,
    "contractId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaAdjustment" (
    "id" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "categoryCode" "TicketCategoryCode" NOT NULL,
    "type" "QuotaAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "contractId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaAlert" (
    "id" TEXT NOT NULL,
    "competency" TEXT NOT NULL,
    "categoryCode" "TicketCategoryCode" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "contractId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "HolidayScope" NOT NULL,
    "municipality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportContract_organizationId_key" ON "SupportContract"("organizationId");

-- CreateIndex
CREATE INDEX "SupportContract_active_idx" ON "SupportContract"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ContractQuota_contractId_categoryCode_key" ON "ContractQuota"("contractId", "categoryCode");

-- CreateIndex
CREATE INDEX "QuotaAdjustment_contractId_competency_idx" ON "QuotaAdjustment"("contractId", "competency");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaAlert_contractId_competency_categoryCode_threshold_key" ON "QuotaAlert"("contractId", "competency", "categoryCode", "threshold");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_name_key" ON "Holiday"("date", "name");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Ticket_categoryCode_competency_idx" ON "Ticket"("categoryCode", "competency");

-- CreateIndex
CREATE INDEX "Ticket_severity_openedAt_idx" ON "Ticket"("severity", "openedAt");

-- CreateIndex
CREATE INDEX "Ticket_parentTicketId_idx" ON "Ticket"("parentTicketId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_parentTicketId_fkey" FOREIGN KEY ("parentTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportContract" ADD CONSTRAINT "SupportContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractQuota" ADD CONSTRAINT "ContractQuota_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SupportContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaAdjustment" ADD CONSTRAINT "QuotaAdjustment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SupportContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaAlert" ADD CONSTRAINT "QuotaAlert_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SupportContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
