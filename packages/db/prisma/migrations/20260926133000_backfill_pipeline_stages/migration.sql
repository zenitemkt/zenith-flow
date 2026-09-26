-- Repair agencies that existed before the four required commercial stages.
WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "agencyId" ORDER BY "order", "createdAt", "id") AS position
  FROM "pipeline_stage"
)
UPDATE "pipeline_stage" AS stage
SET "order" = -1000 - ranked.position
FROM ranked
WHERE stage."id" = ranked."id";

INSERT INTO "pipeline_stage" ("id", "agencyId", "name", "order", "kind", "createdAt")
SELECT
  'ps_' || substr(md5(random()::text || agency."id" || required.kind::text), 1, 22),
  agency."id",
  required.name,
  -2000 - required.canonical_order,
  required.kind,
  CURRENT_TIMESTAMP
FROM "agency" AS agency
CROSS JOIN (
  VALUES
    ('NEW_CONTACT'::"PipelineStageKind", 'Novo contato', 0),
    ('IN_PROGRESS'::"PipelineStageKind", 'Em andamento', 1),
    ('QUALIFIED'::"PipelineStageKind", 'Qualificado', 2),
    ('PROPOSAL_RECEIVED'::"PipelineStageKind", 'Recebeu proposta', 3)
) AS required(kind, name, canonical_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "pipeline_stage" AS existing
  WHERE existing."agencyId" = agency."id" AND existing."kind" = required.kind
);

WITH normalized AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "agencyId"
      ORDER BY
        CASE "kind"
          WHEN 'NEW_CONTACT'::"PipelineStageKind" THEN 0
          WHEN 'IN_PROGRESS'::"PipelineStageKind" THEN 1
          WHEN 'QUALIFIED'::"PipelineStageKind" THEN 2
          WHEN 'PROPOSAL_RECEIVED'::"PipelineStageKind" THEN 3
          ELSE 4
        END,
        "order", "createdAt", "id"
    ) - 1 AS new_order
  FROM "pipeline_stage"
)
UPDATE "pipeline_stage" AS stage
SET "order" = normalized.new_order
FROM normalized
WHERE stage."id" = normalized."id";

-- Repair the newest open negotiation for leads whose status advanced while
-- the target stage did not exist. Preserve the change as append-only history.
WITH latest_open AS (
  SELECT
    opportunity."id", opportunity."stageId", opportunity."agencyId",
    lead."status" AS lead_status,
    row_number() OVER (
      PARTITION BY opportunity."leadId"
      ORDER BY opportunity."createdAt" DESC, opportunity."id" DESC
    ) AS position
  FROM "opportunity" AS opportunity
  INNER JOIN "lead" AS lead ON lead."id" = opportunity."leadId"
  WHERE opportunity."status" = 'OPEN'
    AND lead."status" IN ('EM_ANDAMENTO', 'QUALIFICADO')
), moves AS (
  SELECT latest_open."id" AS opportunity_id, latest_open."stageId" AS from_stage_id, target."id" AS to_stage_id
  FROM latest_open
  INNER JOIN "pipeline_stage" AS target
    ON target."agencyId" = latest_open."agencyId"
   AND target."kind" = CASE latest_open.lead_status
     WHEN 'EM_ANDAMENTO' THEN 'IN_PROGRESS'::"PipelineStageKind"
     WHEN 'QUALIFICADO' THEN 'QUALIFIED'::"PipelineStageKind"
   END
  WHERE latest_open.position = 1 AND latest_open."stageId" <> target."id"
)
INSERT INTO "opportunity_status_history" (
  "id", "opportunityId", "fromStageId", "toStageId", "toStatus", "reason", "createdAt"
)
SELECT
  'osh_' || substr(md5(random()::text || moves.opportunity_id), 1, 21),
  moves.opportunity_id, moves.from_stage_id, moves.to_stage_id, 'OPEN',
  'Sincronização reparada após criação das etapas da pipeline', CURRENT_TIMESTAMP
FROM moves;

WITH latest_open AS (
  SELECT
    opportunity."id", opportunity."agencyId", lead."status" AS lead_status,
    row_number() OVER (
      PARTITION BY opportunity."leadId"
      ORDER BY opportunity."createdAt" DESC, opportunity."id" DESC
    ) AS position
  FROM "opportunity" AS opportunity
  INNER JOIN "lead" AS lead ON lead."id" = opportunity."leadId"
  WHERE opportunity."status" = 'OPEN'
    AND lead."status" IN ('EM_ANDAMENTO', 'QUALIFICADO')
), moves AS (
  SELECT latest_open."id" AS opportunity_id, target."id" AS to_stage_id
  FROM latest_open
  INNER JOIN "pipeline_stage" AS target
    ON target."agencyId" = latest_open."agencyId"
   AND target."kind" = CASE latest_open.lead_status
     WHEN 'EM_ANDAMENTO' THEN 'IN_PROGRESS'::"PipelineStageKind"
     WHEN 'QUALIFICADO' THEN 'QUALIFIED'::"PipelineStageKind"
   END
  WHERE latest_open.position = 1
)
UPDATE "opportunity" AS opportunity
SET "stageId" = moves.to_stage_id, "updatedAt" = CURRENT_TIMESTAMP
FROM moves
WHERE opportunity."id" = moves.opportunity_id AND opportunity."stageId" <> moves.to_stage_id;
