-- Identidade "zênite" vira o padrão do painel (pedido do Kevin, 2026-09-24).
-- O botão sol/lua continua funcionando: quem quiser volta pro claro.
ALTER TABLE "user" ALTER COLUMN "themePreference" SET DEFAULT 'DARK';

UPDATE "user" SET "themePreference" = 'DARK' WHERE "themePreference" = 'LIGHT';
