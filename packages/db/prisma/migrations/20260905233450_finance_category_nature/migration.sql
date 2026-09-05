-- CreateEnum
CREATE TYPE "FinanceCategoryNature" AS ENUM ('RECEITA', 'IMPOSTO_DEDUCAO', 'CUSTO_DIRETO', 'DESPESA_OPERACIONAL', 'DESPESA_FINANCEIRA', 'INVESTIMENTO', 'TRANSFERENCIA');

-- AlterTable
ALTER TABLE "finance_category" ADD COLUMN     "nature" "FinanceCategoryNature" NOT NULL DEFAULT 'DESPESA_OPERACIONAL';


-- Backfill: categorias de RECEITA já existentes devem ter natureza RECEITA,
-- não o default DESPESA_OPERACIONAL (que só faz sentido pra categorias de DESPESA).
UPDATE "finance_category" SET "nature" = 'RECEITA' WHERE "type" = 'RECEITA';
