-- AlterTable
ALTER TABLE "instagram_automation_rule" ADD COLUMN "buttons" JSONB;
UPDATE "instagram_automation_rule" SET "buttons" = jsonb_build_array(jsonb_build_object('text', "buttonText", 'url', "buttonUrl"))
  WHERE "buttonText" IS NOT NULL AND "buttonUrl" IS NOT NULL;
ALTER TABLE "instagram_automation_rule" DROP COLUMN "buttonText";
ALTER TABLE "instagram_automation_rule" DROP COLUMN "buttonUrl";

-- AlterTable
ALTER TABLE "instagram_automation_log" ADD COLUMN "buttonUrls" JSONB;
UPDATE "instagram_automation_log" SET "buttonUrls" = jsonb_build_array("buttonUrl") WHERE "buttonUrl" IS NOT NULL;
ALTER TABLE "instagram_automation_log" DROP COLUMN "buttonUrl";
ALTER TABLE "instagram_automation_log" ADD COLUMN "clickedButtonIndex" INTEGER;
