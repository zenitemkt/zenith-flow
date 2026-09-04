-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('AGENCY', 'CLIENT');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('SUPER_ADMIN', 'AGENCY_ADMIN', 'MANAGER', 'ANALYST', 'FINANCE', 'HR', 'CLIENT_ADMIN', 'CLIENT_VIEWER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkspaceKind" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invitedByUserId" TEXT,
    "inviteToken" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "agency_slug_key" ON "agency"("slug");

-- CreateIndex
CREATE INDEX "workspace_agencyId_idx" ON "workspace"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_inviteToken_key" ON "membership"("inviteToken");

-- CreateIndex
CREATE INDEX "membership_userId_idx" ON "membership"("userId");

-- CreateIndex
CREATE INDEX "membership_agencyId_idx" ON "membership"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_workspaceId_email_key" ON "membership"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "audit_log_agencyId_idx" ON "audit_log"("agencyId");

-- CreateIndex
CREATE INDEX "audit_log_resourceType_resourceId_idx" ON "audit_log"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
