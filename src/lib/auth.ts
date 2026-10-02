import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';

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
 * Generates JWT access token with enhanced security.
 * Uses HS512 algorithm and includes unique JTI claim.
 */
export function generateToken(payload: UserSessionPayload, expiresIn: SignOptions['expiresIn'] = '8h'): string {
  // Add unique token identifier to prevent replay attacks
  const tokenPayload = {
    ...payload,
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
