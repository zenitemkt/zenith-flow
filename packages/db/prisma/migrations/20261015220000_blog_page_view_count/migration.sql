-- CreateTable
CREATE TABLE "blog_page_view_count" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_page_view_count_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_page_view_count_agencyId_slug_key" ON "blog_page_view_count"("agencyId", "slug");

-- AddForeignKey
ALTER TABLE "blog_page_view_count" ADD CONSTRAINT "blog_page_view_count_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
