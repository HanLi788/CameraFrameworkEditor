function Get-BuildFailureAdvice([string]$Stage, [string]$Details) {
    if ($Details -match '(?i)504|502|503|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|fetch failed|socket hang up') {
        $advice = '下载服务或网络链路没有正常响应。普通网页能打开，也不代表该下载地址可用。请稍后重试，或检查代理及下载地址。'
        if ($Stage -eq '准备 Electron') {
            $advice += "`n可在当前 PowerShell 窗口设置镜像后重新运行：`n" + '$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"' + "`n" + '.\构建编辑器.bat'
        }
        return $advice
    }
    if ($Details -match '(?i)CERT_|certificate|self.signed|unable to verify') { return '下载连接的证书校验失败。请检查系统时间和代理证书配置，保持证书校验开启。' }
    if ($Details -match '(?i)ENOSPC|disk full|not enough space') { return '磁盘空间不足。请检查项目目录和系统临时目录所在磁盘的可用空间。' }
    if ($Details -match '(?i)EBUSY|EPERM|EACCES|access.*denied|being used|占用|拒绝访问') { return '文件被占用或无写入权限。请保存并关闭 release 中正在运行的编辑器及游戏窗口，检查目录权限后重试。' }
    if ($Details -match '(?i)checksum|hash mismatch|integrity|EINTEGRITY') { return '下载文件未通过完整性校验。请重新下载，或换用可信下载入口；不要跳过校验。' }
    if ($Stage -eq '编译编辑器') { return '源码编译未通过，请根据上方的文件名、行号和错误修复后重试。' }
    if ($Stage -eq '生成发布文件') { return '打包未完成。请查看上方打包工具的具体错误；本次没有报告构建成功。' }
    return '请查看上方错误及详细日志，处理后重新运行构建脚本。'
}

function Get-BuildSession([string]$SessionPath, [string]$TempRoot, [string]$Token) {
    # Only accept an immediate, non-link child of the original TEMP directory.
    $root = [IO.Path]::GetFullPath($TempRoot).TrimEnd('\', '/')
    $full = [IO.Path]::GetFullPath($SessionPath).TrimEnd('\', '/')
    if ([IO.Path]::GetDirectoryName($full) -ine $root -or
        [IO.Path]::GetFileName($full) -notmatch '^CameraFrameworkEditor-build-[a-f0-9]{32}$') { throw '拒绝清理：临时目录超出允许范围。' }
    if (!(Test-Path -LiteralPath $full)) { return $null }
    $item = Get-Item -LiteralPath $full -Force -ErrorAction Stop
    if (!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw '拒绝清理：临时目录不是普通目录。' }
    $marker = Join-Path $full 'session.json'
    $markerItem = Get-Item -LiteralPath $marker -Force -ErrorAction Stop
    if ($markerItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '拒绝清理：会话标记不能是链接。' }
    $data = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($data.Token -cne $Token -or $data.Directory -ine $full) { throw '拒绝清理：会话标记不匹配。' }
    return $data
}

function Remove-BuildTree([string]$Directory) {
    # Never traverse junctions or symbolic links, including links inside tool temp files.
    foreach ($entry in @(Get-ChildItem -LiteralPath $Directory -Force -ErrorAction Stop)) {
        if ($entry.PSIsContainer) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($entry.FullName) }
            else { Remove-BuildTree $entry.FullName }
        } else { Remove-Item -LiteralPath $entry.FullName -Force -ErrorAction Stop }
    }
    [IO.Directory]::Delete($Directory)
}

function Remove-BuildSession([string]$SessionPath, [string]$TempRoot, [string]$Token) {
    $session = Get-BuildSession $SessionPath $TempRoot $Token
    if (!$session) { return }
    # Preserve the marker until tool files have been removed, so a failed attempt can retry.
    foreach ($entry in @(Get-ChildItem -LiteralPath $SessionPath -Force -ErrorAction Stop)) {
        if ($entry.Name -eq 'session.json') { continue }
        if ($entry.PSIsContainer) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { [IO.Directory]::Delete($entry.FullName) }
            else { Remove-BuildTree $entry.FullName }
        } else { Remove-Item -LiteralPath $entry.FullName -Force -ErrorAction Stop }
    }
    Remove-Item -LiteralPath (Join-Path $SessionPath 'session.json') -Force -ErrorAction Stop
    [IO.Directory]::Delete($SessionPath)
}
