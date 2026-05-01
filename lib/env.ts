const PLACEHOLDER_PREFIX = "your-";
const PLACEHOLDER_FRAGMENT = "your-collector-worker";
const ALLOWED_URL_PROTOCOLS = new Set(["http:", "https:"]);

export function hasConfiguredEnvValue(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !trimmed.startsWith(PLACEHOLDER_PREFIX) && !trimmed.includes(PLACEHOLDER_FRAGMENT);
}

export function readConfiguredEnvValue(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed && hasConfiguredEnvValue(trimmed) ? trimmed : "";
}

export function readConfiguredUrlOrigin(value: string | undefined | null): string {
  const configured = readConfiguredEnvValue(value);

  if (!configured) {
    return "";
  }

  try {
    const url = new URL(configured);

    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

export function readConfiguredUrlBase(value: string | undefined | null): string {
  const configured = readConfiguredEnvValue(value);

  if (!configured) {
    return "";
  }

  try {
    const url = new URL(configured);

    if (!ALLOWED_URL_PROTOCOLS.has(url.protocol)) {
      return "";
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${pathname === "/" ? "" : pathname}`;
  } catch {
    return "";
  }
}
