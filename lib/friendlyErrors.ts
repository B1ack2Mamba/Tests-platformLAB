export const CONNECTION_TROUBLE_HINT =
  "Если проблема повторяется, включите VPN или подключитесь к домашнему интернету через Wi-Fi. У жителей Москвы сейчас могут наблюдаться задержки и перебои связи.";

function errorText(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.name;
  const anyError = error as { message?: unknown; name?: unknown; code?: unknown; details?: unknown };
  return String(anyError.message || anyError.code || anyError.details || anyError.name || "");
}

export function friendlyErrorMessage(error: unknown, fallback = "Ошибка") {
  const raw = errorText(error).trim();
  const normalized = raw || fallback;

  if (/ERR_NETWORK_CHANGED/i.test(normalized)) {
    return `Соединение изменилось во время загрузки (ERR_NETWORK_CHANGED). ${CONNECTION_TROUBLE_HINT}`;
  }

  if (/Failed to fetch|fetch failed|NetworkError|Load failed|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|network/i.test(normalized)) {
    return `Не удалось связаться с сервером. ${CONNECTION_TROUBLE_HINT}`;
  }

  if ((error as { name?: unknown } | null)?.name === "AbortError") {
    return `${fallback}. ${CONNECTION_TROUBLE_HINT}`;
  }

  return normalized;
}

export function withConnectionTroubleHint(message: string) {
  return `${message} ${CONNECTION_TROUBLE_HINT}`;
}
