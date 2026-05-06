const DYNAMIC_IMPORT_RELOAD_KEY = "__dynamic_import_recovery__";
const DYNAMIC_IMPORT_RELOAD_WINDOW_MS = 5_000;
const DYNAMIC_IMPORT_RECOVERY_RESET_MS = 3_000;

export const getErrorMessage = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
};

export const isDynamicImportFailure = (value: unknown) => {
  const message = getErrorMessage(value);
  // Also catches the generic React lazy error that sometimes manifests as undefined default
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Cannot read properties of undefined \(reading 'default'\)/i.test(message);
};

export const recoverFromDynamicImportFailure = () => {
  if (typeof window === "undefined") return false;

  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  try {
    const raw = sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY);
    const previousAttempt = raw ? (JSON.parse(raw) as { path?: string; ts?: number }) : null;

    if (
      previousAttempt?.path === currentPath &&
      typeof previousAttempt.ts === "number" &&
      Date.now() - previousAttempt.ts < DYNAMIC_IMPORT_RELOAD_WINDOW_MS
    ) {
      return false;
    }

    sessionStorage.setItem(
      DYNAMIC_IMPORT_RELOAD_KEY,
      JSON.stringify({ path: currentPath, ts: Date.now() }),
    );
  } catch {
    // Ignore storage issues and still try a reload.
  }

  window.location.reload();
  return true;
};

export const scheduleDynamicImportRecoveryReset = () => {
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    try {
      sessionStorage.removeItem(DYNAMIC_IMPORT_RELOAD_KEY);
    } catch {
      // Ignore storage issues.
    }
  }, DYNAMIC_IMPORT_RECOVERY_RESET_MS);
};
