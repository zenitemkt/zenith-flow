-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('RASCUNHO', 'ENVIADA', 'APROVADA', 'CORRIGIDA');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'TIMER');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "estimatedMinutes" INTEGER;

-- CreateTable
CREATE TABLE "timesheet" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'RASCUNHO',
    "submittedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_status_history" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "fromStatus" "TimesheetStatus",
    "toStatus" "TimesheetStatus" NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "timesheetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "description" TEXT,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry_edit" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "previousMinutes" INTEGER NOT NULL,
    "reason" TEXT,
    "editedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entry_edit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timesheet_agencyId_idx" ON "timesheet"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_userId_weekStart_key" ON "timesheet"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "timesheet_status_history_timesheetId_idx" ON "timesheet_status_history"("timesheetId");

-- CreateIndex
CREATE INDEX "time_entry_agencyId_idx" ON "time_entry"("agencyId");

-- CreateIndex
CREATE INDEX "time_entry_userId_idx" ON "time_entry"("userId");

-- CreateIndex
CREATE INDEX "time_entry_taskId_idx" ON "time_entry"("taskId");

-- CreateIndex
CREATE INDEX "time_entry_timesheetId_idx" ON "time_entry"("timesheetId");

-- CreateIndex
CREATE INDEX "time_entry_edit_timeEntryId_idx" ON "time_entry_edit"("timeEntryId");

-- AddForeignKey
ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_status_history" ADD CONSTRAINT "timesheet_status_history_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_edit" ADD CONSTRAINT "time_entry_edit_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

