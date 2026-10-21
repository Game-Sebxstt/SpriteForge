import { z } from "zod";

/**
 * Server-side environment validation for the NextAuth route.
 *
 * Validates the auth secrets at module load so a misconfiguration fails fast
 * with a clear, named error listing the missing keys, instead of NextAuth's
 * opaque runtime error (replaces the previous `as string` casts).
 */
const authEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/**
 * Error thrown when required auth environment variables are missing or empty.
 */
export class AuthEnvError extends Error {
  public constructor(missing: string[]) {
    super(
      `Missing required auth environment variables: ${missing.join(", ")}. ` +
        "Set them (e.g. in .env.local) before using the auth route."
    );
    this.name = "AuthEnvError";
  }
}

/**
 * Parses and returns the validated auth environment.
 * @throws {AuthEnvError} when one or more required keys are missing/empty.
 */
export function getAuthEnv(): AuthEnv {
  const result = authEnvSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
  });

  if (!result.success) {
    const missing = result.error.issues.map((issue) => String(issue.path[0]));
    throw new AuthEnvError([...new Set(missing)]);
  }

  return result.data;
}
