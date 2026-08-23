-- CreateTable
CREATE TABLE "Star" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT,
    "folderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Star_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Star_userId_createdAt_idx" ON "Star"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Star_fileId_idx" ON "Star"("fileId");

-- CreateIndex
CREATE INDEX "Star_folderId_idx" ON "Star"("folderId");

-- Exactly one subject per row.
ALTER TABLE "Star"
  ADD CONSTRAINT "Star_subject_xor"
  CHECK (
    ("fileId" IS NOT NULL AND "folderId" IS NULL)
    OR ("fileId" IS NULL AND "folderId" IS NOT NULL)
  );

-- Partial unique indexes (NULLs are distinct in Postgres unique indexes).
CREATE UNIQUE INDEX "Star_userId_fileId_key"
  ON "Star"("userId", "fileId")
  WHERE "fileId" IS NOT NULL;

CREATE UNIQUE INDEX "Star_userId_folderId_key"
  ON "Star"("userId", "folderId")
  WHERE "folderId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Star" ADD CONSTRAINT "Star_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Star" ADD CONSTRAINT "Star_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Star" ADD CONSTRAINT "Star_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
