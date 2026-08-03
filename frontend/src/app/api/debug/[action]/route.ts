import { NextRequest, NextResponse } from "next/server";
import { HOST, API_TOKEN } from "@/utils/constants";

export const dynamic = "force-dynamic";

type Action = "register-test" | "login-test";

async function handleRegisterTest(request: NextRequest) {
  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = body.name ?? "";
  const email = body.email ?? "";
  const password = body.password ?? "";
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Body must have name, email and password" },
      { status: 400 }
    );
  }
  const url = `${HOST}users/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ nombre: name, mail: email, password }),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // leave as string
    }
    return NextResponse.json({
      backendUrl: url,
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      body: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error calling backend", detail: String(err) },
      { status: 500 }
    );
  }
}

async function handleLoginTest(request: NextRequest) {
  let email = "";
  let password = "";
  if (request.method === "GET") {
    email = request.nextUrl.searchParams.get("email") ?? "";
    password = request.nextUrl.searchParams.get("password") ?? "";
  } else {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    email = body.email ?? "";
    password = body.password ?? "";
  }
  if (!email || !password) {
    return NextResponse.json(
      {
        error:
          request.method === "GET"
            ? "Query params email and password required"
            : "Body must have email and password",
      },
      { status: 400 }
    );
  }
  const url = `${HOST}users_login/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify({ mail: email, email, password }),
    });
    const text = await res.text();
    let bodyRes: unknown = text;
    try {
      bodyRes = JSON.parse(text);
    } catch {
      // leave as text
    }
    return NextResponse.json({
      backendUrl: url,
      status: res.status,
      statusText: res.statusText,
      body: bodyRes,
      hasAccessToken:
        typeof bodyRes === "object" &&
        bodyRes !== null &&
        "access_token" in bodyRes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error calling backend", detail: String(err) },
      { status: 500 }
    );
  }
}

/**
 * Rutas de diagnóstico:
 * - POST /api/debug/register-test  body: { name, email, password }
 * - GET/POST /api/debug/login-test  (GET: ?email= &password= ; POST: body { email, password })
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (action === "login-test") return handleLoginTest(request);
  if (action === "register-test") {
    return NextResponse.json(
      { error: "register-test requires POST with body { name, email, password }" },
      { status: 400 }
    );
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (action === "register-test") return handleRegisterTest(request);
  if (action === "login-test") return handleLoginTest(request);
  return NextResponse.json({ error: "Invalid action" }, { status: 404 });
}
