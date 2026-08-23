-- Drop legacy password column; auth is handled by Supabase Auth.
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
