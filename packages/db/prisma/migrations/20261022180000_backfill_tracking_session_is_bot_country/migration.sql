-- DataMigration: sessões fora do Brasil (ex.: "Springfield" nos EUA) que
-- não batiam na lista fixa de cidades de datacenter, mas são, na prática,
-- tráfego não humano pra um site que só atende clientes no Brasil.
UPDATE "tracking_session"
SET "isBot" = true
WHERE "isBot" = false
  AND "country" IS NOT NULL
  AND upper("country") <> 'BR';
