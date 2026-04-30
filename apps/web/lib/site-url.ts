const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const withProtocol = (url: string) => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
};

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL;

  if (configuredUrl?.trim()) {
    return trimTrailingSlash(withProtocol(configuredUrl.trim()));
  }

  return "http://localhost:3000";
}

