-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "themePreference" "ThemePreference" NOT NULL DEFAULT 'LIGHT';
