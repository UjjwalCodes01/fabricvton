import { authenticate, sessionStorage } from "../shopify.server";

const TOKEN_EXPIRY_WINDOW_MS = 5 * 60 * 1000;

export type OfflineTokenState =
  | "active"
  | "expiring_soon"
  | "expired"
  | "refresh_expired"
  | "missing";

export interface OfflineTokenStatus {
  shop: string;
  state: OfflineTokenState;
  isValid: boolean;
  needsReauth: boolean;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  scope: string | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

function toIsoString(value: Date | number | string | null | undefined) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface StoredSessionShape {
  isExpired: (withinMillisecondsOfExpiry?: number) => boolean;
  toObject: () => { refreshTokenExpires?: string | number | Date | null };
  expires?: string | number | Date | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  scope?: string | null;
}

function getRefreshExpiry(session: StoredSessionShape) {
  const refreshExpiry = session.toObject().refreshTokenExpires;
  if (!refreshExpiry) return null;

  const date = new Date(refreshExpiry);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getOfflineSession(shop: string) {
  const sessions = await (sessionStorage as {
    findSessionsByShop: (shopDomain: string) => Promise<
      Array<StoredSessionShape & { isOnline?: boolean | null }>
    >;
  }).findSessionsByShop(shop);

  return sessions.find((session) => !session.isOnline) ?? null;
}

export function getOfflineTokenStatus(
  shop: string,
  session: StoredSessionShape | null,
): OfflineTokenStatus {
  if (!session) {
    return {
      shop,
      state: "missing",
      isValid: false,
      needsReauth: true,
      expiresAt: null,
      refreshExpiresAt: null,
      scope: null,
      hasAccessToken: false,
      hasRefreshToken: false,
    };
  }

  const refreshExpiresAt = getRefreshExpiry(session);
  const expiresAt = session.expires ? new Date(session.expires) : null;
  const hasRefreshToken = Boolean(session.refreshToken);
  const hasAccessToken = Boolean(session.accessToken);
  const now = Date.now();

  if (refreshExpiresAt && refreshExpiresAt.getTime() <= now) {
    return {
      shop,
      state: "refresh_expired",
      isValid: false,
      needsReauth: true,
      expiresAt: toIsoString(expiresAt),
      refreshExpiresAt: toIsoString(refreshExpiresAt),
      scope: session.scope ?? null,
      hasAccessToken,
      hasRefreshToken,
    };
  }

  if (session.isExpired()) {
    return {
      shop,
      state: "expired",
      isValid: hasRefreshToken,
      needsReauth: !hasRefreshToken,
      expiresAt: toIsoString(expiresAt),
      refreshExpiresAt: toIsoString(refreshExpiresAt),
      scope: session.scope ?? null,
      hasAccessToken,
      hasRefreshToken,
    };
  }

  if (session.isExpired(TOKEN_EXPIRY_WINDOW_MS)) {
    return {
      shop,
      state: "expiring_soon",
      isValid: true,
      needsReauth: false,
      expiresAt: toIsoString(expiresAt),
      refreshExpiresAt: toIsoString(refreshExpiresAt),
      scope: session.scope ?? null,
      hasAccessToken,
      hasRefreshToken,
    };
  }

  return {
    shop,
    state: "active",
    isValid: true,
    needsReauth: false,
    expiresAt: toIsoString(expiresAt),
    refreshExpiresAt: toIsoString(refreshExpiresAt),
    scope: session.scope ?? null,
    hasAccessToken,
    hasRefreshToken,
  };
}

export async function authenticateAdminRequest(request: Request) {
  const auth = await authenticate.admin(request);
  const shop = auth.session.shop;
  const offlineSession = await getOfflineSession(shop);
  const offlineToken = getOfflineTokenStatus(shop, offlineSession);

  return {
    ...auth,
    offlineSession,
    offlineToken,
  };
}

export function formatTokenTimestamp(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
