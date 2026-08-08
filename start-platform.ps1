$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
$WebDir = Join-Path $ProjectDir "apps\web"
$RuntimeDir = Join-Path $ProjectDir "runtime"
$LogFile = Join-Path $RuntimeDir "frontend.log"
$ErrorLog = Join-Path $RuntimeDir "frontend-error.log"
$PidFile = Join-Path $RuntimeDir "frontend.pid"
$UrlFile = Join-Path $RuntimeDir "platform.url"

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  福建省房屋安全动态监测平台"
Write-Host "  Windows 开发环境启动器"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "未检测到 Node.js。请安装 Node.js 22 LTS 后重新运行。" -ForegroundColor Red
    Write-Host "下载地址：https://nodejs.org/"
    Read-Host "按 Enter 键关闭"
    exit 1
}

$NodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($NodeMajor -lt 22) {
    Write-Host "当前 Node.js 版本过低，需要 Node.js 22 或更高版本。" -ForegroundColor Red
    Read-Host "按 Enter 键关闭"
    exit 1
}

$Vinext = Join-Path $WebDir "node_modules\.bin\vinext.cmd"
if (-not (Test-Path $Vinext)) {
    Write-Host "首次运行，正在安装前端依赖……" -ForegroundColor Yellow
    Push-Location $WebDir
    try { npm.cmd install } finally { Pop-Location }
}

if (Test-Path $PidFile) {
    $SavedPid = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($SavedPid -and (Get-Process -Id $SavedPid -ErrorAction SilentlyContinue)) {
        if (Test-Path $UrlFile) {
            $SavedUrl = (Get-Content $UrlFile | Select-Object -First 1).Trim()
            try {
                Invoke-WebRequest -Uri $SavedUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
                Write-Host "平台已在运行：$SavedUrl" -ForegroundColor Green
                Start-Process $SavedUrl
                exit 0
            } catch {}
        }
    }
}

Remove-Item $UrlFile -ErrorAction SilentlyContinue
Write-Host "正在启动平台并自动选择可用端口……" -ForegroundColor Yellow
$Process = Start-Process node -ArgumentList "scripts/start_web.mjs" -WorkingDirectory $WebDir -RedirectStandardOutput $LogFile -RedirectStandardError $ErrorLog -PassThru
Set-Content -Path $PidFile -Value $Process.Id -Encoding ascii

$PlatformUrl = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $UrlFile) {
        $Candidate = (Get-Content $UrlFile | Select-Object -First 1).Trim()
        try {
            Invoke-WebRequest -Uri $Candidate -UseBasicParsing -TimeoutSec 2 | Out-Null
            $PlatformUrl = $Candidate
            break
        } catch {}
    }
}

if (-not $PlatformUrl) {
    Write-Host "平台启动失败，请查看 runtime 目录中的日志。" -ForegroundColor Red
    if (Test-Path $ErrorLog) { Get-Content $ErrorLog -Tail 20 }
    Read-Host "按 Enter 键关闭"
    exit 1
}

Write-Host "平台已启动：$PlatformUrl" -ForegroundColor Green
Write-Host "关闭本窗口不会停止平台。"
Start-Process $PlatformUrl

