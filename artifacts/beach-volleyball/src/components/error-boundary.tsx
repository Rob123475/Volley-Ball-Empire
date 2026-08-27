import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last-resort catch for render-time exceptions.
 *
 * Without one, any thrown error unmounts the whole tree and leaves a blank
 * Electron window — the same symptom as a failed launch, which makes the two
 * impossible to tell apart in a bug report. This at least names the error and
 * offers a reload.
 */
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Goes to the devtools console and, in the packaged app, to the main
    // process log via the renderer's stdio.
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-8">
        <div className="w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <div className="text-4xl">🏐</div>
          <div>
            <h1 className="text-lg font-black text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/50">
              The game hit an unexpected error and could not draw this screen.
              Your save is on disk and has not been changed.
            </p>
          </div>

          <pre className="max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-left text-[11px] leading-relaxed text-white/40">
            {error.message}
          </pre>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-secondary py-3 text-sm font-black text-white transition-all hover:bg-secondary/90"
            >
              Reload the game
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 rounded-xl border border-white/10 py-3 text-sm font-bold text-white/60 transition-all hover:text-white"
            >
              Back to title
            </button>
          </div>
        </div>
      </div>
    );
  }
}
