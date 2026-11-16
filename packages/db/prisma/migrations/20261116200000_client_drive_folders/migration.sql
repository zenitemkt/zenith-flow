CREATE TABLE "drive_clients_root" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_clients_root_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drive_clients_root_agencyId_key" ON "drive_clients_root"("agencyId");

CREATE TABLE "client_drive_folder" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "rootId" TEXT NOT NULL,
    "awaitingId" TEXT NOT NULL,
    "reworkId" TEXT NOT NULL,
    "approvedId" TEXT NOT NULL,
    "publishedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_drive_folder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_drive_folder_clientId_key" ON "client_drive_folder"("clientId");
