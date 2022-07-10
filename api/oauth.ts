import { Status } from "https://deno.land/std@0.147.0/http/http_status.ts";
import { serve, ServeInit } from "https://deno.land/std@0.147.0/http/server.ts";

/**
 * Small localStorage wrapper that parses and serializes JSON.
 */
export function jsonStorage<T>(key: string) {
  let cache: T | undefined;
  return {
    get() {
      if (cache === undefined) {
        try {
          cache = JSON.parse(localStorage.getItem(key)!);
        } catch {
          // Ignore errors parsing JSON
        }
      }
      return cache;
    },
    set(value: T | undefined) {
      cache = value;
      if (value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    },
  };
}

/**
 * Opens a URL in the user's default browser.
 * This runs a OS-specific command to open the URL.
 */
export function launchBrowser(url: URL) {
  console.log("Opening browser to:", url.href);
  switch (Deno.build.os) {
    case "windows":
      return Deno.run({
        cmd: ["cmd", "/c", "start", url.href.replaceAll("&", "^&")],
      });
    case "darwin":
      return Deno.run({ cmd: ["open", url.href] });
    case "linux":
      return Deno.run({ cmd: ["gio", "open", url.href] });
  }
}

/**
 * Helper function that logs the hostname and port the server is running on.
 */
function logServerHost(
  { hostname, port }: { hostname: string; port: number },
) {
  if (hostname === "0.0.0.0") {
    hostname = "localhost";
  }
  console.info(`OAuth server running on ${hostname}:${port}`);
}

/**
 * Starts a server that listens for a OAuth 2.0 redirect on the given port.
 * The server is automatically closed when the redirect is received.
 */
export async function listenForOauthRedirect(
  redirectPath: string,
  expectedState?: string,
  options: Partial<Deno.ListenOptions> = {},
) {
  const controller = new AbortController();
  const serverOptions: ServeInit = {
    ...options,
    signal: controller.signal,
    onListen: logServerHost,
  };

  try {
    return await new Promise<string>((resolve, reject) => {
      serve((request) => {
        const url = new URL(request.url);
        if (url.pathname === redirectPath) {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");

          if (state !== expectedState) {
            reject(new Error(`Invalid state: ${state}`));
            return new Response("Invalid state", { status: Status.BadRequest });
          }

          if (code) {
            // If we have an authorization code, we can resolve the promise.
            resolve(code);
            return new Response("Success", { status: Status.OK });
          } else {
            // Otherwise there was some error and we should reject the promise.
            const errorText = url.searchParams.get("error") ??
              "No authorization code provided";
            reject(new Error(errorText));
            return new Response(errorText, { status: Status.BadRequest });
          }
        } else {
          // If the path was incorrect, leave the server open and keep waiting
          return new Response("Wrong path", { status: Status.NotFound });
        }
      }, serverOptions);
    });
  } finally {
    // Close the server once the promise resolves or rejects.
    controller.abort();
  }
}
