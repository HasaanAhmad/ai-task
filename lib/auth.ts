const COOKIE_NAME = "orderline_auth";
const PEPPER = "orderline-v1";

export { COOKIE_NAME };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getAppPassword(): string | null {
  const password = process.env.APP_PASSWORD?.trim();
  return password ? password : null;
}

export async function sessionTokenFromPassword(
  password: string,
): Promise<string> {
  const secret = process.env.AUTH_SECRET?.trim() || PEPPER;
  const payload = `${PEPPER}:${password}:${secret}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedSessionToken(): Promise<string | null> {
  const password = getAppPassword();
  if (!password) return null;
  return sessionTokenFromPassword(password);
}

export async function isValidSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedSessionToken();
  if (!expected) return false;
  return timingSafeEqual(token, expected);
}

export async function verifyPassphrase(input: string): Promise<boolean> {
  const password = getAppPassword();
  if (!password) return false;
  const [got, expected] = await Promise.all([
    sessionTokenFromPassword(input),
    sessionTokenFromPassword(password),
  ]);
  return timingSafeEqual(got, expected);
}
