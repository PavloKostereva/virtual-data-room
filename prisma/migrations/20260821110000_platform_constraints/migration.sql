-- Constraints and indexes that Prisma's schema language cannot express.

-- 1. Exactly one root folder per data room.
--    Sibling uniqueness is covered by Folder_parentId_name_key, but that constraint is
--    inert for the root (parentId IS NULL, and NULLs are distinct in a unique index).
CREATE UNIQUE INDEX "Folder_dataRoomId_root_key"
  ON "Folder" ("dataRoomId")
  WHERE "parentId" IS NULL;

-- 2. A share must point at exactly the subject its type declares.
ALTER TABLE "Share"
  ADD CONSTRAINT "Share_subject_matches_type"
  CHECK (
    ("subjectType" = 'DATA_ROOM' AND "folderId" IS NULL AND "fileId" IS NULL)
    OR ("subjectType" = 'FOLDER' AND "folderId" IS NOT NULL AND "fileId" IS NULL)
    OR ("subjectType" = 'FILE' AND "fileId" IS NOT NULL AND "folderId" IS NULL)
  );

-- 3. Public links carry a token, restricted shares never do.
ALTER TABLE "Share"
  ADD CONSTRAINT "Share_token_matches_mode"
  CHECK (
    ("mode" = 'PUBLIC_LINK' AND "token" IS NOT NULL)
    OR ("mode" = 'RESTRICTED' AND "token" IS NULL)
  );

-- 4. Subtree reads/deletes and subtree aggregates are prefix scans over the materialised
--    path, so they need a text_pattern_ops index to use `path LIKE '<prefix>%'`.
CREATE INDEX "Folder_dataRoomId_path_prefix_idx"
  ON "Folder" ("dataRoomId", "path" text_pattern_ops);

-- 5. Case-insensitive substring search on file names across a data room.
--    A trigram index keeps `name ILIKE '%term%'` off a sequential scan at 100k+ files.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "File_name_trgm_idx"
  ON "File" USING gin ("name" gin_trgm_ops);

CREATE INDEX "Folder_name_trgm_idx"
  ON "Folder" USING gin ("name" gin_trgm_ops);
