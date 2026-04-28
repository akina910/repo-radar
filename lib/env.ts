const PLACEHOLDER_PREFIX = "your-";
const PLACEHOLDER_FRAGMENT = "your-collector-worker";

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
