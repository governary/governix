import { compare } from "bcryptjs";
import { NextResponse } from "next/server";

import { userRepository } from "@governix/db";
import { loginRequestSchema, publicUserSchema } from "@governix/shared/auth";

import { createSessionToken, getSessionCookie } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid login payload.",
          issues: parsed.error.flatten()
        }
      },
      { status: 400 }
    );
  }

  const user = await userRepository.findByEmail(parsed.data.email);

  if (!user || user.status !== "active") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password."
        }
      },
      { status: 401 }
    );
  }

  const validPassword = await compare(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password."
        }
      },
      { status: 401 }
    );
  }

  const session = publicUserSchema.parse({
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status
  });
  const token = await createSessionToken(session);

  const response = NextResponse.json({
    ok: true,
    user: session
  });

  response.cookies.set(getSessionCookie(token));
  return response;
}

