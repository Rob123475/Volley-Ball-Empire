<#
  Rob, 16 Oct: what Windows itself receives from a program's audio, read only.

  For every audio session on the default output device whose process is named
  -ProcessName (Electron plays sound from a child process with the game's exe
  name), every -EveryMs for -Seconds: the session's peak meter (after the
  program's own Windows mixer volume), its mixer volume and its mute. Also the
  device's own volume and mute. Nothing is changed.

  Usage: powershell -NoProfile -File windows-audio-meter.ps1 -ProcessName "Beach Volleyball Empire" -Seconds 10
  Prints one JSON line.
#>
param([string]$ProcessName = "Beach Volleyball Empire", [double]$Seconds = 10, [int]$EveryMs = 50)

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace VbeAudio {
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDeviceEnumeratorCom {}

  [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
  }

  [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
  }

  [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr a, int b, out IntPtr c);
    int GetSimpleAudioVolume(IntPtr a, int b, out IntPtr c);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
  }

  [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioSessionEnumerator {
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, [MarshalAs(UnmanagedType.IUnknown)] out object session);
  }

  [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int state);
    int GetDisplayName(out IntPtr a); int SetDisplayName(IntPtr a, IntPtr b); int GetIconPath(out IntPtr a); int SetIconPath(IntPtr a, IntPtr b);
    int GetGroupingParam(out Guid a); int SetGroupingParam(IntPtr a, IntPtr b); int RegisterAudioSessionNotification(IntPtr a); int UnregisterAudioSessionNotification(IntPtr a);
    int GetSessionIdentifier(out IntPtr a); int GetSessionInstanceIdentifier(out IntPtr a);
    [PreserveSig] int GetProcessId(out int pid);
  }

  [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioMeterInformation { [PreserveSig] int GetPeakValue(out float peak); }

  [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ISimpleAudioVolume {
    int SetMasterVolume(float level, IntPtr ctx);
    [PreserveSig] int GetMasterVolume(out float level);
    int SetMute(bool mute, IntPtr ctx);
    [PreserveSig] int GetMute(out bool mute);
  }

  [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IAudioEndpointVolume {
    int RegisterControlChangeNotify(IntPtr a); int UnregisterControlChangeNotify(IntPtr a); int GetChannelCount(out int a);
    int SetMasterVolumeLevel(float a, IntPtr b); int SetMasterVolumeLevelScalar(float a, IntPtr b); int GetMasterVolumeLevel(out float a);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(int a, float b, IntPtr c); int SetChannelVolumeLevelScalar(int a, float b, IntPtr c);
    int GetChannelVolumeLevel(int a, out float b); int GetChannelVolumeLevelScalar(int a, out float b);
    int SetMute(bool a, IntPtr b);
    [PreserveSig] int GetMute(out bool mute);
  }

  public class Session { public int Pid; public int State; public float Volume; public bool Muted; public float Peak; }

  public static class Meter {
    static IMMDevice Device() {
      var e = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
      IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out d)); return d;
    }
    public static float[] DeviceVolume() {
      Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
      Marshal.ThrowExceptionForHR(Device().Activate(ref iid, 23, IntPtr.Zero, out o));
      var v = (IAudioEndpointVolume)o; float level; bool mute;
      v.GetMasterVolumeLevelScalar(out level); v.GetMute(out mute);
      return new float[] { level, mute ? 1f : 0f };
    }
    public static List<Session> Sessions(string processName) {
      Guid iid = typeof(IAudioSessionManager2).GUID; object o;
      Marshal.ThrowExceptionForHR(Device().Activate(ref iid, 23, IntPtr.Zero, out o));
      IAudioSessionEnumerator en; Marshal.ThrowExceptionForHR(((IAudioSessionManager2)o).GetSessionEnumerator(out en));
      int n; en.GetCount(out n);
      var list = new List<Session>();
      for (int i = 0; i < n; i++) {
        object s; if (en.GetSession(i, out s) != 0) continue;
        var c = (IAudioSessionControl2)s; int pid; c.GetProcessId(out pid);
        string name = "";
        try { name = Process.GetProcessById(pid).ProcessName; } catch { }
        if (!string.Equals(name, processName, StringComparison.OrdinalIgnoreCase)) continue;
        var x = new Session(); x.Pid = pid; c.GetState(out x.State);
        ((ISimpleAudioVolume)s).GetMasterVolume(out x.Volume); ((ISimpleAudioVolume)s).GetMute(out x.Muted);
        ((IAudioMeterInformation)s).GetPeakValue(out x.Peak);
        list.Add(x);
      }
      return list;
    }
  }
}
"@

$dev = [VbeAudio.Meter]::DeviceVolume()
$peak = 0.0; $reads = 0; $readsWithSession = 0; $sessions = @{}
$until = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $until) {
  $list = [VbeAudio.Meter]::Sessions($ProcessName)
  $reads++
  if ($list.Count -gt 0) { $readsWithSession++ }
  foreach ($s in $list) {
    if ($s.Peak -gt $peak) { $peak = $s.Peak }
    $sessions["$($s.Pid)"] = @{ pid = $s.Pid; state = $s.State; mixerVolume = [math]::Round($s.Volume, 3); mixerMuted = $s.Muted }
  }
  Start-Sleep -Milliseconds $EveryMs
}
@{ processName = $ProcessName; seconds = $Seconds; reads = $reads; readsWithSession = $readsWithSession; peak = [math]::Round($peak, 5)
   deviceVolume = [math]::Round($dev[0], 3); deviceMuted = ($dev[1] -gt 0); sessions = @($sessions.Values) } | ConvertTo-Json -Compress -Depth 4
