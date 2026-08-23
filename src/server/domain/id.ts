import { randomBytes, randomUUID } from "node:crypto";

export const newId = (): string => randomUUID();

export const newShareToken = (): string => randomBytes(24).toString("base64url");
