function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return trimTrailingSlash(configuredUrl);
  if (typeof window !== "undefined" && window.location.origin) {
    return trimTrailingSlash(window.location.origin);
  }
  return "";
}

export function getAppUrl(path = "/") {
  const baseUrl = getAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
