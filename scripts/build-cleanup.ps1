param([Parameter(Mandatory=$true)][string]$SessionPath, [Parameter(Mandatory=$true)][string]$Token)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'build-support.ps1')
$tempRoot = [IO.Path]::GetTempPath()
try {
    $session = Get-BuildSession $SessionPath $tempRoot $Token
    if (!$session) { exit 0 }
    $owner = Get-Process -Id $session.OwnerId -ErrorAction SilentlyContinue
    if ($owner -and $owner.StartTime.ToUniversalTime().Ticks.ToString() -eq $session.OwnerStarted) {
        $owner.WaitForExit()
    }
    # Console shutdown can take a moment to release child-process file handles.
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try { Remove-BuildSession $SessionPath $tempRoot $Token; exit 0 }
        catch { Start-Sleep -Milliseconds 500 }
    }
    exit 1
} catch { exit 1 }
