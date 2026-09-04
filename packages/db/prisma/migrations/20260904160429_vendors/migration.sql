-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('HOMOLOGADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "VendorOrderStatus" AS ENUM ('SOLICITADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'HOMOLOGADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_order" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "taskId" TEXT,
    "description" TEXT NOT NULL,
    "status" "VendorOrderStatus" NOT NULL DEFAULT 'SOLICITADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_agencyId_idx" ON "vendor"("agencyId");

-- CreateIndex
CREATE INDEX "vendor_order_vendorId_idx" ON "vendor_order"("vendorId");

-- AddForeignKey
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order" ADD CONSTRAINT "vendor_order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_order" ADD CONSTRAINT "vendor_order_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

