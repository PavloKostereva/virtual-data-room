import { badRequest } from "@/server/errors";

export const MAX_NAME_LENGTH = 255;

const ILLEGAL_NAME_CHARACTERS = /[\\/:*?"<>|]|[\p{Cc}]/u;

export function normaliseName(rawName: string): string {
  const name = rawName.trim().replace(/\s+/g, " ");

  if (name.length === 0) throw badRequest("Name cannot be empty.");
  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`Name cannot be longer than ${MAX_NAME_LENGTH} characters.`);
  }
  if (name === "." || name === "..") throw badRequest("That name is reserved.");
  if (ILLEGAL_NAME_CHARACTERS.test(name)) {
    throw badRequest('A name cannot contain \\ / : * ? " < > |');
  }

  return name;
}

interface SplitName {
  stem: string;
  extension: string;
}

export function splitName(name: string): SplitName {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { stem: name, extension: "" };
  }
  return { stem: name.slice(0, dotIndex), extension: name.slice(dotIndex) };
}

export function nextAvailableName(desiredName: string, takenNames: Iterable<string>): string {
  const taken = new Set(takenNames);
  if (!taken.has(desiredName)) return desiredName;

  const { stem, extension } = splitName(desiredName);
  const baseStem = stem.replace(/ \(\d+\)$/, "");

  for (let counter = 1; counter <= taken.size + 1; counter += 1) {
    const candidate = `${baseStem} (${counter})${extension}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${baseStem} (${Date.now()})${extension}`;
}
