import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import {
  SESSION_ABSOLUTE_MS,
  SESSION_TOKEN_TTL_SECONDS,
} from './session';

// JWT Secret validation - fail fast if not properly configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is required and must be at least 32 characters. ' +
    'Generate a secure secret with: openssl rand -base64 64'
  );
}

export interface UserSessionPayload {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  subdomain: string;
  jti?: string;
  /** Session start time (seconds since epoch). Survives token rotation. */
  sst?: number;
  /** Issued at (seconds) - set by jsonwebtoken. */
  iat?: number;
  /** Expiry (seconds) - the server-enforced inactivity deadline. */
  exp?: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates password strength according to security policy.
 * Requirements: min 12 chars, uppercase, lowercase, digit, special character
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function hashPassword(password: string): Promise<string> {
  // Increased from 10 to 12 for stronger security
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a JWT access token with enhanced security.
 *
 * Uses HS512, a unique JTI claim, and - by default - a lifetime equal to the
 * inactivity window (SESSION_IDLE_MINUTES). The token is slid forward while
 * the user is active (see `rotateSessionToken`), which makes the idle timeout
 * server-enforced instead of a UI-only convention: a token abandoned on a
 * forgotten tab simply stops verifying.
 *
 * The `sst` (session start time) claim records when the user actually signed
 * in and is carried across rotations so the absolute session cap can never be
 * extended by staying active.
 */
export function generateToken(
  payload: UserSessionPayload,
  expiresIn: SignOptions['expiresIn'] = SESSION_TOKEN_TTL_SECONDS
): string {
  // Built explicitly so a previous token's timing claims (iat/exp/jti) are
  // never re-signed - jsonwebtoken would reject `exp` alongside `expiresIn`.
  const tokenPayload = {
    userId: payload.userId,
    tenantId: payload.tenantId,
    email: payload.email,
    fullName: payload.fullName,
    role: payload.role,
    subdomain: payload.subdomain,
    // Session start: preserved on rotation, stamped now on first issue.
    sst: payload.sst ?? Math.floor(Date.now() / 1000),
    // Unique token identifier to prevent replay attacks
    jti: crypto.randomUUID(),
  };

  return jwt.sign(tokenPayload, JWT_SECRET!, {
    expiresIn,
    algorithm: 'HS512',
  });
}

export function verifyToken(token: string): UserSessionPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      algorithms: ['HS512'],
    });
    return payload as UserSessionPayload;
  } catch {
    return null;
  }
}

/** Moment the session started (ms). Falls back to the issue time. */
export function sessionStartMs(session: UserSessionPayload): number {
  const start = session.sst ?? session.iat;
  return typeof start === 'number' ? start * 1000 : Date.now();
}

/** Hard deadline (ms) for the session, regardless of how active the user is. */
export function sessionAbsoluteDeadlineMs(session: UserSessionPayload): number {
  return sessionStartMs(session) + SESSION_ABSOLUTE_MS;
}

/** True once the session has outlived the absolute cap. */
export function isSessionBeyondAbsoluteLimit(
  session: UserSessionPayload,
  now: number = Date.now()
): boolean {
  return now >= sessionAbsoluteDeadlineMs(session);
}

/**
 * Issues a fresh token for an active user, resetting the inactivity window but
 * keeping the original session start. Returns null when the session has hit
 * the absolute cap and the user must sign in again.
 */
export function rotateSessionToken(
  session: UserSessionPayload,
  overrides: Partial<UserSessionPayload> = {}
): { token: string; expiresAt: number; sessionExpiresAt: number } | null {
  if (isSessionBeyondAbsoluteLimit(session)) return null;

  const sst = session.sst ?? session.iat ?? Math.floor(Date.now() / 1000);
  const token = generateToken({
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
    subdomain: session.subdomain,
    ...overrides,
    sst,
  });

  return {
    token,
    expiresAt: Date.now() + SESSION_TOKEN_TTL_SECONDS * 1000,
    sessionExpiresAt: sst * 1000 + SESSION_ABSOLUTE_MS,
  };
}

/** Extracts the bearer token from an incoming request, if present. */
export function getBearerToken(req: { headers: { get(name: string): string | null } }): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}
