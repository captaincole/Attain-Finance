import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

interface SignedUrlPayload {
  userId: string;
  resource: string;
}

/**
 * Generate a signed JWT token for secure, time-limited file downloads
 * @param userId - The authenticated user's ID from Clerk
 * @param resource - The resource type (e.g., 'transactions')
 * @param expiresInSeconds - Token expiration time in seconds (default: 600 = 10 minutes)
 * @returns JWT token string
 */
export function generateSignedToken(
  userId: string,
  resource: string,
  expiresInSeconds: number = 600
): string {
  const payload: SignedUrlPayload = {
    userId,
    resource,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: expiresInSeconds,
  });
}

/**
 * Verify and decode a signed JWT token
 * @param token - The JWT token to verify
 * @returns Decoded payload with userId and resource, or null if invalid
 */
export function verifySignedToken(token: string): SignedUrlPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SignedUrlPayload;
    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Generate a complete signed download URL
 * @param baseUrl - The base URL of the server (e.g., https://personal-finance-mcp-d0eg.onrender.com)
 * @param userId - The authenticated user's ID
 * @param resource - The resource type
 * @param expiresInSeconds - Token expiration time in seconds
 * @returns Complete URL with signed token
 */
export function generateSignedUrl(
  baseUrl: string,
  userId: string,
  resource: string,
  expiresInSeconds: number = 600
): string {
  const token = generateSignedToken(userId, resource, expiresInSeconds);
  return `${baseUrl}/api/data/${resource}?token=${token}`;
}
