const DEFAULT_INCOMPLETE_PROJECT_RESULTS_EMAILS = ["jdanova_2002@mail.ru"];

function normalizeEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}

export function canAccessIncompleteProjectResults(email: string | null | undefined) {
  return DEFAULT_INCOMPLETE_PROJECT_RESULTS_EMAILS.includes(normalizeEmail(email));
}

export function canUseIncompleteProjectResults(
  email: string | null | undefined,
  completed: number,
  total: number
) {
  return canAccessIncompleteProjectResults(email) && total > 0 && completed > 0 && completed < total;
}
