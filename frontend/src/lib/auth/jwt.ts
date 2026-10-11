import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { randomUUID } from "crypto";

const ALG = "RS256";
const ISSUER = process.env.JWT_ISSUER ?? "bridgeone-erp";
const AUDIENCE = process.env.JWT_AUDIENCE ?? "bridgeone-erp-client";
const EXPIRY = process.env.JWT_EXPIRY ?? "8h";

function parsePem(raw: string) {
  return raw.replace(/\\n/g, "\n");
}

async function privateKey() {
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set");
  return importPKCS8(parsePem(pem), ALG);
}

async function publicKey() {
  const pem = process.env.JWT_PUBLIC_KEY;
  if (!pem) throw new Error("JWT_PUBLIC_KEY is not set");
  return importSPKI(parsePem(pem), ALG);
}

export interface JwtPayload {
  sub: string;   // user id
  jti: string;   // unique token id (for revocation)
  name: string;
  phone: string;
  role: string;
}

export async function signToken(payload: Omit<JwtPayload, "jti">): Promise<{ token: string; jti: string; expiresAt: Date }> {
  const jti = randomUUID();
  const key = await privateKey();

  // Parse expiry to compute expiresAt date
  const hours = parseInt(EXPIRY) || 8;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const token = await new SignJWT({ name: payload.name, phone: payload.phone, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(EXPIRY)
    .sign(key);

  return { token, jti, expiresAt };
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const key = await publicKey();
  const { payload } = await jwtVerify(token, key, { issuer: ISSUER, audience: AUDIENCE });
  return {
    sub: payload.sub as string,
    jti: payload.jti as string,
    name: payload["name"] as string,
    phone: payload["phone"] as string,
    role: payload["role"] as string,
  };
}
