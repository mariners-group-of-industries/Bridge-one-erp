import { cookies } from "next/headers";

export const COOKIE_NAME = "bridgeone_auth";
const IS_PROD = process.env.NODE_ENV === "production";

export async function setAuthCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getAuthCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value;
}
