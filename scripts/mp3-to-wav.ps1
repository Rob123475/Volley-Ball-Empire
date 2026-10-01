# Overnight brief 30 Sep, item 21: MP3 -> WAV (16-bit PCM) with Windows' own media transcoder
# (Windows.Media.Transcoding; nothing to install). Used by elevenlabs-crowd.mjs to read Rob's own crowd clips.
# Usage: powershell -File scripts/mp3-to-wav.ps1 <in.mp3> <outDir> <name.wav>
param([string]$Src, [string]$OutDir, [string]$Name)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Media.Transcoding.MediaTranscoder,Windows.Media.Transcoding,ContentType=WindowsRuntime]
$null = [Windows.Media.MediaProperties.MediaEncodingProfile,Windows.Media.MediaProperties,ContentType=WindowsRuntime]
$ext = [System.WindowsRuntimeSystemExtensions].GetMethods()
$asTaskOp = ($ext | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
$asTaskActProg = ($ext | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncActionWithProgress`1' })[0]
function Await($op, [Type]$t) { $task = $asTaskOp.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }

$in = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Src)) ([Windows.Storage.StorageFile])
$folder = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($OutDir)) ([Windows.Storage.StorageFolder])
$out = Await ($folder.CreateFileAsync($Name, [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
$profile = [Windows.Media.MediaProperties.MediaEncodingProfile]::CreateWav([Windows.Media.MediaProperties.AudioEncodingQuality]::High)
$tc = New-Object Windows.Media.Transcoding.MediaTranscoder
$prep = Await ($tc.PrepareFileTranscodeAsync($in, $out, $profile)) ([Windows.Media.Transcoding.PrepareTranscodeResult])
if (-not $prep.CanTranscode) { throw "cannot transcode ${Src}: $($prep.FailureReason)" }
$task = $asTaskActProg.MakeGenericMethod([double]).Invoke($null, @($prep.TranscodeAsync())); $task.Wait(-1) | Out-Null
