CREATE TYPE "PipelineStageKind" AS ENUM ('NEW_CONTACT', 'IN_PROGRESS', 'QUALIFIED', 'PROPOSAL_RECEIVED');

ALTER TABLE "pipeline_stage" ADD COLUMN "kind" "PipelineStageKind";

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "agencyId" ORDER BY "order", "createdAt", "id") AS position
  FROM "pipeline_stage"
)
UPDATE "pipeline_stage" AS stage
SET "kind" = CASE ranked.position
  WHEN 1 THEN 'NEW_CONTACT'::"PipelineStageKind"
  WHEN 2 THEN 'IN_PROGRESS'::"PipelineStageKind"
  WHEN 3 THEN 'QUALIFIED'::"PipelineStageKind"
  WHEN 4 THEN 'PROPOSAL_RECEIVED'::"PipelineStageKind"
  ELSE NULL
END
FROM ranked
WHERE stage."id" = ranked."id";

UPDATE "pipeline_stage" SET "name" = 'Em andamento' WHERE "kind" = 'IN_PROGRESS' AND "name" = 'Qualificação';
UPDATE "pipeline_stage" SET "name" = 'Qualificado' WHERE "kind" = 'QUALIFIED' AND "name" = 'Proposta enviada';
UPDATE "pipeline_stage" SET "name" = 'Recebeu proposta' WHERE "kind" = 'PROPOSAL_RECEIVED' AND "name" = 'Negociação';

CREATE UNIQUE INDEX "pipeline_stage_agencyId_kind_key" ON "pipeline_stage"("agencyId", "kind");