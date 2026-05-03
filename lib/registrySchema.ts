export function isRegistrySchemaMissing(error: { message?: string | null } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("registry_comment") || message.includes("commercial_project_registry_comments");
}
