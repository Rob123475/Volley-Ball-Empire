/**
 * Update 1, overnight brief part 8 (Rob, 14 Oct, item 8): Settings, from the
 * gear in the sidebar and on the title screen. Everything is remembered on
 * this PC: the window (fullscreen or windowed, its size, the zoom) by the
 * desktop game in a small file in its user-data folder (electron/
 * window-settings.js, through electron/preload.js); the rest in localStorage
 * (the music's volume and mute, the same as the music bar's; Auto or Manual on
 * the court, the same key as before; since 15 Oct (O-5) the match sound's two
 * volumes, the crowd and the commentary, which the court page sends to the 3D
 * court; since 16 Oct a master volume over everything). The Sound and Controls
 * panels are shared with the 3D court's own settings (components/sound-settings.tsx,
 * components/controls-settings.tsx), so they can be changed during a match.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Volume2, Gamepad2, BookOpen, ArrowLeft, Video, FastForward } from "lucide-react";
import { SoundSettings } from "@/components/sound-settings";
import { ControlsSettings } from "@/components/controls-settings";
import { CameraSettings } from "@/components/camera-settings";
import { SkipSettings } from "@/components/skip-settings";
import { BannerSetting, GuestsSetting } from "@/components/banner-setting";
import { ExitGame } from "@/components/exit-game";
import { readControlMode, saveControlMode, readCourtCamera, saveCourtCamera, readCourtSkips, saveCourtSkips, type ControlMode, type CourtCamera, type CourtSkips } from "@/lib/court-settings";

type WindowSettings = { mode: "windowed" | "fullscreen"; size: string | null; zoom: number; sizes?: string[]; defaultSize?: string; zoomMin?: number; zoomMax?: number };
type WindowBridge = { get: () => Promise<WindowSettings>; set: (patch: Partial<WindowSettings>) => Promise<WindowSettings> };
const bridge = (): WindowBridge | null => ((window as unknown as { vbeWindow?: WindowBridge }).vbeWindow ?? null);

const SIZE_LABEL = (s: string) => s.replace("x", " × ");

export default function SettingsPage() {
  const [win, setWin] = useState<WindowSettings | null>(null);
  const [mode, setMode] = useState<ControlMode>(readControlMode);
  const [camera, setCamera] = useState<CourtCamera>(readCourtCamera);
  const [skips, setSkips] = useState<CourtSkips>(readCourtSkips);

  useEffect(() => { bridge()?.get().then(setWin).catch(() => setWin(null)); }, []);
  const setWindow = async (patch: Partial<WindowSettings>) => {
    const b = bridge(); if (!b) return;
    const next = await b.set(patch);
    setWin((w) => ({ ...(w ?? {}), ...next }));
  };
  const chooseMode = (m: ControlMode) => { setMode(m); saveControlMode(m); };
  const chooseCamera = (c: CourtCamera) => { setCamera(c); saveCourtCamera(c); };
  const chooseSkips = (k: CourtSkips) => { setSkips(k); saveCourtSkips(k); };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8" data-testid="settings-page">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
          <h1 className="text-3xl font-black tracking-tight text-primary">Settings</h1>
        </div>

        {/* Display */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Display</CardTitle>
            <CardDescription>Changes apply at once and again next time you start the game.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!win ? (
              <p className="text-sm text-muted-foreground">The window settings are in the desktop game.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(["windowed", "fullscreen"] as const).map((m) => (
                    <Button key={m} size="sm" variant={win.mode === m ? "default" : "outline"} onClick={() => setWindow({ mode: m })} data-testid={`display-${m}`}>
                      {m === "windowed" ? "Windowed" : "Fullscreen"}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Window size</p>
                  <div className="flex flex-wrap gap-2">
                    {(win.sizes ?? []).map((s) => (
                      <Button key={s} size="sm" variant={win.size === s ? "default" : "outline"} disabled={win.mode === "fullscreen"} onClick={() => setWindow({ size: s })}>
                        {SIZE_LABEL(s)}{s === win.defaultSize ? " (default)" : ""}
                      </Button>
                    ))}
                  </div>
                  {!win.size && <p className="text-xs text-muted-foreground">The game fills the screen until you pick a size.</p>}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Zoom: {Math.round(win.zoom * 100)}%</p>
                  <input type="range" min={Math.round((win.zoomMin ?? 0.8) * 100)} max={Math.round((win.zoomMax ?? 1.5) * 100)} step={5}
                    value={Math.round(win.zoom * 100)} onChange={(e) => setWindow({ zoom: Number(e.target.value) / 100 })}
                    className="w-full max-w-sm" data-testid="display-zoom" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sound */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Volume2 className="h-4 w-4" /> Sound</CardTitle>
            <CardDescription>The master volume over everything; the music, the same as the music bar (which is still there for skipping songs); and the match sound on the 3D court.</CardDescription>
          </CardHeader>
          <CardContent>
            <SoundSettings />
          </CardContent>
        </Card>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Gamepad2 className="h-4 w-4" /> Controls</CardTitle>
            <CardDescription>Who plays your pair on the 3D court. You can still switch during a match with Tab (View or Share on a pad), or in the match's own settings (the gear above the court).</CardDescription>
          </CardHeader>
          <CardContent>
            <ControlsSettings mode={mode} onChoose={chooseMode} />
          </CardContent>
        </Card>

        {/* Camera (1.2 B1) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Video className="h-4 w-4" /> Camera</CardTitle>
            <CardDescription>The 3D court's two looks: TV, where the camera roams like a broadcast, or Game, one of six fixed views. Remembered for when you play and for when you watch.</CardDescription>
          </CardHeader>
          <CardContent>
            <CameraSettings camera={camera} onChange={chooseCamera} />
          </CardContent>
        </Card>

        {/* Match presentation (1.2 B5) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><FastForward className="h-4 w-4" /> Match presentation</CardTitle>
            <CardDescription>Between points the court shows the scorer, the other side and replays of the big moments; before the match the walk-on, after it the winners. Skip what you like, so a long career never slows down.</CardDescription>
          </CardHeader>
          <CardContent>
            <SkipSettings skips={skips} onChange={chooseSkips} />
            <div className="mt-5"><BannerSetting /></div>
            <div className="mt-5"><GuestsSetting /></div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4" /><span className="font-semibold">Rules and how to play</span></div>
            <Link href="/settings/rules"><Button size="sm" variant="outline" data-testid="settings-rules">Open the rules</Button></Link>
          </CardContent>
        </Card>

        {/* Exit (Rob, 16 Oct) */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Your career is saved as you play.</span>
            <ExitGame />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
