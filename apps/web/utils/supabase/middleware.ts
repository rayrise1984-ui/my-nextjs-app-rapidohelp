import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseConfig } from "./config";

const PUBLIC_PATHS = new Set(["/", "/auth", "/terms"]);

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/worker") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/profile")
  );
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
}

function redirectWithCookies(request: NextRequest, response: NextResponse, path: string) {
  const redirectResponse = NextResponse.redirect(new URL(path, request.url));
  copyCookies(response, redirectResponse);
  return redirectResponse;
}

function getWorkspacePath(role: string | null | undefined, isWorker: boolean) {
  if (role === "admin") return "/admin";
  if (role === "agent" || isWorker) return "/worker";
  return "/dashboard";
}

export async function updateSession(request: NextRequest) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (PUBLIC_PATHS.has(pathname) || !isProtectedPath(pathname)) {
      return response;
    }

    return redirectWithCookies(request, response, "/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_worker")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = (profile?.full_name ?? "").trim();
  const hasProfile = fullName.length > 0;
  const workspacePath = getWorkspacePath(profile?.role, Boolean(profile?.is_worker));

  if (!hasProfile && pathname !== "/profile") {
    return redirectWithCookies(request, response, "/profile");
  }

  if (pathname === "/profile" && hasProfile) {
    return redirectWithCookies(request, response, workspacePath);
  }

  if (pathname === "/auth") {
    return redirectWithCookies(request, response, hasProfile ? workspacePath : "/profile");
  }

  return response;
}
