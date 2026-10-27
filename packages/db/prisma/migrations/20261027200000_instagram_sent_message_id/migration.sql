-- Leitura nunca casava: o webhook message_reads traz o mid da mensagem enviada, e o log só guardava o mid recebido.
ALTER TABLE "instagram_automation_log" ADD COLUMN "sentMessageId" TEXT;
CREATE UNIQUE INDEX "instagram_automation_log_sentMessageId_key" ON "instagram_automation_log"("sentMessageId");
