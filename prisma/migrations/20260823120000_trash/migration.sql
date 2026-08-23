-- Soft-delete / Drive-style trash. Live sibling names stay unique via partial indexes
-- so a new file can reuse a name that currently sits in the trash.

ALTER TABLE "Folder" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Folder" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "File" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "File" ADD COLUMN "deletedById" TEXT;

DROP INDEX "Folder_parentId_name_key";
DROP INDEX "File_folderId_name_key";

CREATE UNIQUE INDEX "Folder_parentId_name_alive_key"
  ON "Folder" ("parentId", "name")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "File_folderId_name_alive_key"
  ON "File" ("folderId", "name")
  WHERE "deletedAt" IS NULL;

CREATE INDEX "Folder_deletedAt_idx" ON "Folder" ("deletedAt");
CREATE INDEX "File_deletedAt_idx" ON "File" ("deletedAt");
