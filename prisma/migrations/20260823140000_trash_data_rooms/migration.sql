-- Soft-delete data rooms so they can sit in trash for 30 days.

ALTER TABLE "DataRoom" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "DataRoom" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "DataRoom_deletedAt_idx" ON "DataRoom" ("deletedAt");
