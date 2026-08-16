$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Volley-Ball Empire.lnk")
$Shortcut.TargetPath = Join-Path $PSScriptRoot "Launch Volleyball Empire.bat"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Launch Volley-Ball Empire (dev build)"

# Use the app's own icon
$iconPath = Join-Path $PSScriptRoot "electron\icons\volleyball-empire.ico"
if (Test-Path $iconPath) {
    $Shortcut.IconLocation = $iconPath
} else {
    $Shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,27"
}

$Shortcut.Save()
Write-Host "Shortcut created on your Desktop: 'Volley-Ball Empire'"
