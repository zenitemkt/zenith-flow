-- Peça com várias redes e vários formatos (só adiciona colunas; cartões antigos continuam usando channel/format).
ALTER TABLE "content_item" ADD COLUMN "channels" "ContentChannel"[] DEFAULT ARRAY[]::"ContentChannel"[];
ALTER TABLE "content_item" ADD COLUMN "formats" TEXT[] DEFAULT ARRAY[]::TEXT[];
