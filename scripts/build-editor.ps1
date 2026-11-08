param([switch]$NoPause)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
. (Join-Path $PSScriptRoot 'build-support.ps1')
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempRoot = [IO.Path]::GetTempPath()
$oldTemp = $env:TEMP; $oldTmp = $env:TMP
$sessionPath = $null; $watcher = $null; $mutex = $null; $locked = $false
$buildExit = 1; $stage = '检查构建环境'; $logPath = $null; $stepOutput = ''
$utf8 = [Text.UTF8Encoding]::new($false)

function Invoke-BuildTool([string]$Executable, [string[]]$ToolArguments) {
    $script:stepOutput = ''
    $savedPreference = $ErrorActionPreference
    try {
        # Native stderr is diagnostic output; the process exit code decides success.
        $ErrorActionPreference = 'Continue'
        & $Executable @ToolArguments 2>&1 | ForEach-Object {
            $line = $_.ToString()
            Write-Host $line
            $script:stepOutput += $line + "`n"
            [IO.File]::AppendAllText($logPath, $line + [Environment]::NewLine, $utf8)
        }
        if ($LASTEXITCODE -ne 0) { throw "命令执行失败，退出码：$LASTEXITCODE" }
    } finally { $ErrorActionPreference = $savedPreference }
}

try {
    Set-Location -LiteralPath $projectRoot
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($hash.ComputeHash($utf8.GetBytes($projectRoot.ToLowerInvariant()))).Replace('-', '') }
    finally { $hash.Dispose() }
    $mutex = [Threading.Mutex]::new($false, ('Local\CameraFrameworkEditor.Build.' + $key))
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { throw '此目录已有构建正在运行，请先结束该构建窗口。' }
    $logDirectory = Join-Path $projectRoot 'logs'
    [IO.Directory]::CreateDirectory($logDirectory) | Out-Null
    $logPath = Join-Path $logDirectory 'build-editor.log'
    [IO.File]::WriteAllText($logPath, ('构建开始：' + (Get-Date -Format o) + [Environment]::NewLine), $utf8)

    $token = [Guid]::NewGuid().ToString('N')
    $sessionPath = Join-Path $tempRoot ('CameraFrameworkEditor-build-' + $token)
    [IO.Directory]::CreateDirectory($sessionPath) | Out-Null
    $ownerStarted = (Get-Process -Id $PID).StartTime.ToUniversalTime().Ticks.ToString()
    $marker = @{Token=$token;Directory=$sessionPath;Project=$projectRoot;OwnerId=$PID;OwnerStarted=$ownerStarted} | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $sessionPath 'session.json'), $marker, $utf8)
    # Launch with the original TEMP before setting per-build tool temp variables.
    $cleanupScript = Join-Path $PSScriptRoot 'build-cleanup.ps1'
    $watcher = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Hidden -PassThru -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $cleanupScript + '"'), '-SessionPath', ('"' + $sessionPath + '"'), '-Token', $token)
    $toolTemp = Join-Path $sessionPath 'files'
    [IO.Directory]::CreateDirectory($toolTemp) | Out-Null
    $env:TEMP = $toolTemp; $env:TMP = $toolTemp
    Write-Host ('本次临时目录：' + $sessionPath)
    Write-Host '[1/3] 检查构建环境…'
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (!$node -or !$npm) { throw '未找到 Node.js 或 npm。请安装 Node.js 22.12 或更新版本，然后重新打开构建脚本。' }
    $versionText = & $node.Source --version
    if ($LASTEXITCODE -ne 0 -or $versionText -notmatch '^v(\d+)\.(\d+)\.') { throw '无法读取 Node.js 版本，请检查安装。' }
    if ([int]$Matches[1] -lt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -lt 12)) { throw "当前 Node.js 为 $versionText，需要 22.12 或更新版本。" }
    foreach ($file in @('package.json','package-lock.json','runtime\lua54.exe','runtime\lua54.dll')) {
        if (!(Test-Path -LiteralPath (Join-Path $projectRoot $file) -PathType Leaf)) { throw "缺少必要文件：$file。请完整拉取源码，并将脚本保留在编辑器根目录。" }
    }
    $package = Get-Content -LiteralPath 'package.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($package.version -notmatch '^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$') { throw 'package.json 中的版本号无效。' }
    $missing = @('node_modules\.bin\vite.cmd','node_modules\.bin\tsc.cmd','node_modules\.bin\electron-builder.cmd','node_modules\electron\install.js') | Where-Object { !(Test-Path -LiteralPath $_ -PathType Leaf) }
    if ($missing) {
        $stage = '安装构建依赖'; Write-Host '正在安装锁定版本的依赖，首次运行可能需要联网…'
        Invoke-BuildTool $npm.Source @('ci','--prefer-offline','--no-audit','--no-fund')
    }
    $stage = '准备 Electron'; Write-Host '正在准备 Electron 运行文件，首次下载可能需要联网…'
    Invoke-BuildTool $npm.Source @('run','electron:install')
    if (!(Test-Path -LiteralPath 'node_modules\electron\dist\electron.exe')) { throw '准备完成后仍未找到 Electron 运行文件，请查看下载日志。' }
    $stage = '编译编辑器'; Write-Host '[2/3] 编译编辑器…'
    Invoke-BuildTool $npm.Source @('run','build')
    $stage = '生成发布文件'; Write-Host '[3/3] 生成 Windows x64 程序和安装包…'
    Invoke-BuildTool $npm.Source @('run','package:installer')
    $installer = Join-Path $projectRoot ('release\CameraFrameworkEditor-' + $package.version + '-Setup.exe')
    $program = Join-Path $projectRoot 'release\win-unpacked\相机框架编辑器.exe'
    if (!(Test-Path -LiteralPath $installer) -or !(Test-Path -LiteralPath $program)) { throw '打包命令结束，但没有找到完整发布文件。' }
    $buildExit = 0
    Write-Host "`n构建成功。" -ForegroundColor Green
    Write-Host ('编辑器：' + $program); Write-Host ('安装包：' + $installer)
} catch {
    $message = $_.Exception.Message
    Write-Host ("`n构建失败：" + $stage) -ForegroundColor Red
    Write-Host $message
    $advice = Get-BuildFailureAdvice $stage ($stepOutput + "`n" + $message)
    Write-Host $advice -ForegroundColor Yellow
    if ($logPath) {
        try { [IO.File]::AppendAllText($logPath, "`n构建失败：$stage`n$message`n$advice`n", $utf8) } catch {}
    }
} finally {
    $env:TEMP = $oldTemp; $env:TMP = $oldTmp
    if ($logPath) { Write-Host ('详细日志：' + $logPath) }
    if ($sessionPath) { Write-Host '退出后清理本次临时文件；保留依赖、下载缓存和发布结果。' }
    if (!$NoPause) { try { Write-Host '按 Enter 结束，也可以直接关闭窗口'; Read-Host | Out-Null } catch {} }
    if ($sessionPath) {
        try { Remove-BuildSession $sessionPath $tempRoot $token }
        catch { Write-Host '部分临时文件仍被占用，后台清理进程将在退出后重试。' }
    }
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
exit $buildExit
