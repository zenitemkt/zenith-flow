ALTER TABLE "client_drive_folder" ADD COLUMN "rawId" TEXT;
ALTER TABLE "client_drive_folder" ADD COLUMN "sharedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];
