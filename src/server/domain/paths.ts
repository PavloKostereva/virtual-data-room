

export const PATH_SEPARATOR = "/";

export function buildRootPath(folderId: string): string {
  return `${PATH_SEPARATOR}${folderId}${PATH_SEPARATOR}`;
}

export function buildChildPath(parentPath: string, folderId: string): string {
  return `${parentPath}${folderId}${PATH_SEPARATOR}`;
}

export function pathToIds(path: string): string[] {
  return path.split(PATH_SEPARATOR).filter((segment) => segment.length > 0);
}

export function isDescendantPath(candidatePath: string, ancestorPath: string): boolean {
  return candidatePath.startsWith(ancestorPath);
}

export function toLikePrefix(path: string): string {
  return `${path.replace(/([\\%_])/g, "\\$1")}%`;
}
