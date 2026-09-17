-- Triagem como etapa única: marca a entrada e a conclusão da triagem para que a
-- regra de bloqueio de retorno a EM_TRIAGEM se apoie no histórico de transições,
-- e não no status atual.

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "triageEnteredAt" TIMESTAMP(3),
ADD COLUMN     "triageCompletedAt" TIMESTAMP(3);

-- Backfill a partir do histórico já existente: os eventos de sistema de troca de
-- status são o único registro das transições dos chamados anteriores à regra.
WITH triage_entry AS (
    SELECT "ticketId", MIN("createdAt") AS entered_at
    FROM "Comment"
    WHERE "isSystem" AND "content" = 'Status alterado para EM_TRIAGEM.'
    GROUP BY "ticketId"
)
UPDATE "Ticket" t
SET "triageEnteredAt" = e.entered_at
FROM triage_entry e
WHERE t."id" = e."ticketId";

-- Saiu da triagem quem registrou uma troca para outro status depois de ter
-- entrado nela. Quem ainda está em triagem não teve a etapa concluída.
WITH triage_exit AS (
    SELECT c."ticketId", MIN(c."createdAt") AS exited_at
    FROM "Comment" c
    JOIN "Ticket" t ON t."id" = c."ticketId"
    WHERE c."isSystem"
      AND c."content" LIKE 'Status alterado para %'
      AND c."content" <> 'Status alterado para EM_TRIAGEM.'
      AND t."triageEnteredAt" IS NOT NULL
      AND c."createdAt" > t."triageEnteredAt"
    GROUP BY c."ticketId"
)
UPDATE "Ticket" t
SET "triageCompletedAt" = x.exited_at
FROM triage_exit x
WHERE t."id" = x."ticketId" AND t."status" <> 'EM_TRIAGEM';
