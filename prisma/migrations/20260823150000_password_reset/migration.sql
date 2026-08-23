-- One-time password-reset codes (hashed) for the forgot-password flow.

ALTER TABLE "User" ADD COLUMN "passwordResetHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0;
