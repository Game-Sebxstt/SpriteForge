import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextRequest } from "next/server";
import { getAuthEnv } from "@/lib/server/env";

/**
 * Builds the NextAuth handler lazily on first request.
 *
 * Env validation runs here (not at module top level) so the fail-fast happens
 * when the auth route is actually used, with a clear named error — without
 * breaking `next build`'s page-data collection when secrets are absent.
 */
let handler: ((req: NextRequest, ctx: unknown) => Promise<Response>) | null = null;

function getHandler() {
  if (!handler) {
    const env = getAuthEnv();

    const authOptions: NextAuthOptions = {
      providers: [
        GoogleProvider({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
      ],
      secret: env.AUTH_SECRET,
    };

    handler = NextAuth(authOptions) as unknown as (
      req: NextRequest,
      ctx: unknown
    ) => Promise<Response>;
  }

  return handler;
}

export async function GET(req: NextRequest, ctx: unknown): Promise<Response> {
  return getHandler()(req, ctx);
}

export async function POST(req: NextRequest, ctx: unknown): Promise<Response> {
  return getHandler()(req, ctx);
}
