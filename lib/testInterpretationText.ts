function prettifyKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function toTextParts(value: unknown, depth = 0): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toTextParts(item, depth));
  }

  if (typeof value === "object") {
    const parts: string[] = [];
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nestedParts = toTextParts(nested, depth + 1);
      if (!nestedParts.length) continue;

      if (nestedParts.length === 1 && !nestedParts[0].includes("\n")) {
        parts.push(`${prettifyKey(key)}: ${nestedParts[0]}`);
      } else {
        parts.push(`${prettifyKey(key)}:`);
        parts.push(...nestedParts.map((part) => `${"  ".repeat(Math.max(1, depth + 1))}${part}`));
      }
    }
    return parts;
  }

  return [];
}

export function interpretationToDisplayText(value: unknown) {
  return toTextParts(value).join("\n\n").trim();
}
