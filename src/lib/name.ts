

export function splitBaseName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

export function nextAvailableName(desiredName: string, takenNames: Iterable<string>): string {
  const taken = new Set(takenNames);
  if (!taken.has(desiredName)) return desiredName;

  const dotIndex = desiredName.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < desiredName.length - 1;
  const stem = (hasExtension ? desiredName.slice(0, dotIndex) : desiredName).replace(
    / \(\d+\)$/,
    "",
  );
  const extension = hasExtension ? desiredName.slice(dotIndex) : "";

  for (let counter = 1; counter <= taken.size + 1; counter += 1) {
    const candidate = `${stem} (${counter})${extension}`;
    if (!taken.has(candidate)) return candidate;
  }

  return `${stem} (${taken.size + 1})${extension}`;
}
