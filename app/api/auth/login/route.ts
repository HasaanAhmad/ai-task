import {
  COOKIE_NAME,
  getAppPassword,
  sessionTokenFromPassword,
  verifyPassphrase,
} from "@/lib/auth";

export async function POST(request: Request) {
  if (!getAppPassword()) {
    return Response.json(
      {
        success: false,
        error: "APP_PASSWORD is not configured on the server.",
      },
      { status: 500 },
    );
  }

  let password = "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { password?: string };
    password = body.password ?? "";
  } else {
    const form = await request.formData();
    password = String(form.get("password") ?? "");
  }

  if (!(await verifyPassphrase(password))) {
    return Response.json(
      { success: false, error: "Incorrect passphrase." },
      { status: 401 },
    );
  }

  const token = await sessionTokenFromPassword(password);
  const response = Response.json({ success: true });
  response.headers.append(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${token}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 30}`,
      process.env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  );
  return response;
}
