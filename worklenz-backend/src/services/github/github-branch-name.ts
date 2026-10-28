/**
 * Conservative branch name check: a safe subset of git-check-ref-format that is also valid
 * to interpolate into GitHub API paths.
 */
export function isValidBranchName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  if (name.length < 1 || name.length > 200) return false;
  if (!/^[A-Za-z0-9._/-]+$/.test(name)) return false;
  if (name.startsWith("-") || name.startsWith("/") || name.endsWith("/")) return false;
  if (name.includes("..") || name.includes("//")) return false;
  if (name.endsWith(".") || name.endsWith(".lock")) return false;
  if (name.split("/").some(part => part.startsWith(".") || part.endsWith(".lock"))) return false;
  return true;
}
