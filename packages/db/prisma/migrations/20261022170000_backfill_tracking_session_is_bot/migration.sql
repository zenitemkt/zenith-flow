-- DataMigration: sessões de hoje criadas ANTES do deploy da detecção de bot
-- (2026-10-22, seção 2.1) ficaram com isBot=false (valor padrão da coluna
-- nova), mesmo vindo de cidades conhecidas de datacenter. Backfill único
-- pela mesma heurística de cidade já usada em lib/tracking.ts.
UPDATE "tracking_session"
SET "isBot" = true
WHERE "isBot" = false
  AND lower("city") IN (
    'forest city', 'prineville', 'fort worth', 'ashburn', 'boydton',
    'the dalles', 'council bluffs', 'quincy', 'altoona', 'papillion', 'moses lake'
  );
