-- Tipo do cartão de Operação (só adiciona; cartões antigos ficam como DESIGN).
CREATE TYPE "ContentKind" AS ENUM ('DESIGN', 'ATENDIMENTO', 'FINANCEIRO', 'SITE', 'OUTROS');
ALTER TABLE "content_item" ADD COLUMN "kind" "ContentKind" NOT NULL DEFAULT 'DESIGN';
