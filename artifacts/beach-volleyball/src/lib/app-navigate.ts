/**
 * P-03 — move between screens without reloading the window, from outside React.
 *
 * `window.location.href = "/x"` is a full page load: React, the query cache and
 * MusicProvider's <audio> element are all thrown away and rebuilt, so the
 * soundtrack started again from the title track on every screen before the
 * dashboard (title -> profile picker -> New Career -> dashboard).
 *
 * Components navigate with wouter's `useLocation()`, like the rest of the app.
 * This is for code that is not in the tree — App.tsx's 401 handler lives on
 * the QueryClient. wouter's own `navigate` pushes a history entry and the
 * mounted <Router> follows it, so only the route changes and the music plays on.
 *
 * Paths are router paths ("/login"); the build's base path is added here, the
 * same way App.tsx gives it to the Router.
 */
import { navigate } from "wouter/use-browser-location";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function appNavigate(path: string, options?: { replace?: boolean }): void {
  navigate(`${BASE}${path}`, options);
}

/** The current router path, without the base: what a returnTo should carry. */
export function currentRouterPath(): string {
  const { pathname } = window.location;
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || "/" : pathname;
}
