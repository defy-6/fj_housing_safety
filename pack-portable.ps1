# 便携版（即插即用）打包脚本 - 参考城乡融合项目方案
# 用法：powershell -ExecutionPolicy Bypass -File .\pack-portable.ps1
# 产物：release\fujian-housing-safety-portable-<日期>.zip
# 目标机零安装：内置 Node.js + Python 运行时

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Date = Get-Date -Format "yyyyMMdd"
$Stage = Join-Path $Root "release\_portable_stage"
$TopDir = "fujian-housing-safety"
$Top = Join-Path $Stage $TopDir

Write-Host "=============================================="
Write-Host "  便携版打包（即插即用，目标机零安装）"
Write-Host "=============================================="

# 1. 清空 staging
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Top | Out-Null
if (-not (Test-Path (Join-Path $Root "release"))) { New-Item -ItemType Directory -Force -Path (Join-Path $Root "release") | Out-Null }

# 2. 复制平台本体（排除本机缓存/日志/测试残留）
Write-Host "[1/5] 复制平台本体..."
$skipDirs = @(".git","release","outputs",".reasonix","_portable_stage","node_modules",".wrangler",".vinext",".next",".cache")
$skipFiles = @("frontend.log","frontend-error.log","frontend.pid","platform.url")
function Copy-Tree {
  param([string]$Src,[string]$Dst,[string[]]$SkipDir,[string[]]$SkipFile)
  Get-ChildItem $Src -Directory | Where-Object { $_.Name -notin $SkipDir } | ForEach-Object {
    $target = Join-Path $Dst $_.Name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Tree $_.FullName $target $SkipDir $SkipFile
  }
  Get-ChildItem $Src -File | Where-Object { $_.Name -notin $SkipFile } | Copy-Item -Destination $Dst -Force
}
Copy-Tree $Root $Top $skipDirs $skipFiles
# node_modules 用 robocopy（对大量小文件更快）
robocopy (Join-Path $Root "apps\web\node_modules") (Join-Path $Top "apps\web\node_modules") /E /NFL /NDL /NJH /NJS /NC /NS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy node_modules 失败" }

# 3. 内置 Node.js 运行时
Write-Host "[2/5] 内置 Node.js 运行时..."
$nodeSrc = "C:\Users\e1351579\AppData\Local\Programs\nodejs"
$nodeDst = Join-Path $Top "runtime\nodejs"
Copy-Tree $nodeSrc $nodeDst @() @()

# 4. 内置 Python 运行时（核心 + backend 依赖）
Write-Host "[3/5] 内置 Python 运行时（裁剪版）..."
$pySrc = "C:\Users\e1351579\AppData\Local\Programs\Python\Python313"
$pyDst = Join-Path $Top "runtime\python"
# 复制核心文件（python.exe / dll / vcruntime）
New-Item -ItemType Directory -Force -Path $pyDst | Out-Null
Get-ChildItem $pySrc -File | Copy-Item -Destination $pyDst -Force
# 复制标准库（排除 site-packages 等大目录）
$libDst = Join-Path $pyDst "Lib"
New-Item -ItemType Directory -Force -Path $libDst | Out-Null
Get-ChildItem "$pySrc\Lib" -Directory | Where-Object { $_.Name -notin @("site-packages","test","idlelib","tkinter","ensurepip") } | ForEach-Object { Copy-Item -Path $_.FullName -Destination $libDst -Recurse -Force }
Get-ChildItem "$pySrc\Lib" -File | Copy-Item -Destination $libDst -Force
# 用系统 Python 把 backend 依赖装到便携包 site-packages（干净、只含所需包）
Write-Host "[4/5] 安装 backend 依赖到内置 Python..."
$pySitePkgs = Join-Path $pyDst "Lib\site-packages"
New-Item -ItemType Directory -Force -Path $pySitePkgs | Out-Null
& py -3.13 -m pip install --disable-pip-version-check --no-warn-script-location --target $pySitePkgs -r (Join-Path $Root "backend\requirements.txt") 2>&1 | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) { throw "pip install 失败" }

# 5. 写入便携启动脚本与说明
Write-Host "[5/5] 写入便携启动脚本..."
$portableLauncher = @'
@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-platform.ps1"
if errorlevel 1 pause
'@
Set-Content -Path (Join-Path $Top "start-platform.bat") -Value $portableLauncher -Encoding ASCII

# 便携版 ps1：使用内置运行时
$portablePs1 = @'
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$WebDir = Join-Path $Root "apps\web"
$RuntimeDir = Join-Path $Root "runtime"
$NodeExe = Join-Path $RuntimeDir "nodejs\node.exe"
$NpmCmd = Join-Path $RuntimeDir "nodejs\npm.cmd"
$PyExe = Join-Path $RuntimeDir "python\python.exe"
$RuntimeLogDir = Join-Path $Root "runtime"
$UrlFile = Join-Path $RuntimeLogDir "platform.url"
$FrontErr = Join-Path $RuntimeLogDir "frontend-error.log"

New-Item -ItemType Directory -Force -Path $RuntimeLogDir | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  福建省房屋安全动态监测平台（便携版）"
Write-Host "========================================" -ForegroundColor Cyan

# 运行时检查
if (-not (Test-Path $NodeExe)) { Write-Host "缺少内置 Node.js 运行时，请检查解压完整性。" -ForegroundColor Red; Read-Host "按 Enter 关闭"; exit 1 }
if (-not (Test-Path $WebDir)) { Write-Host "缺少前端目录 apps\web，请检查解压完整性。" -ForegroundColor Red; Read-Host "按 Enter 关闭"; exit 1 }

Write-Host "正在启动前端并自动选择可用端口……" -ForegroundColor Yellow
# 用内置 node 跑 start_web.mjs（其内部会调用内置 npm.cmd）
$env:PATH = (Join-Path $RuntimeDir "nodejs") + ";" + $env:PATH
$proc = Start-Process -FilePath $NodeExe -ArgumentList "scripts\start_web.mjs" -WorkingDirectory $WebDir -RedirectStandardOutput (Join-Path $RuntimeLogDir "frontend.log") -RedirectStandardError $FrontErr -PassThru -NoNewWindow
$proc.Id | Out-File (Join-Path $RuntimeLogDir "frontend.pid") -Encoding ascii

$PlatformUrl = $null
for ($i = 0; $i -lt 90; $i++) {
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
    if (Test-Path $FrontErr) { Get-Content $FrontErr -Tail 15 }
    Read-Host "按 Enter 关闭"
    exit 1
}

Write-Host "平台已启动：$PlatformUrl" -ForegroundColor Green
Write-Host "关闭本窗口不会停止平台（日志在 runtime\ 目录）。"
Start-Process $PlatformUrl
'@
Set-Content -Path (Join-Path $Top "start-platform.ps1") -Value $portablePs1 -Encoding UTF8

# MIGRATION-NOTES
@"
福建省房屋安全动态监测平台 - Windows 便携版（即插即用）
打包日期：$(Get-Date -Format "yyyy-MM-dd HH:mm")

一、使用
1. 解压（建议 7-Zip/WinRAR，路径避免中文和空格）
2. 双击 start-platform.bat
3. 浏览器自动打开 http://localhost:3100/

二、说明
- 目标机零安装：已内置 Node.js 22 与 Python 运行时
- 数据位置：
  主数据库  database\housing-safety.sqlite
  前端数据  apps\web\public\data\
  运行日志  logs\
- 智能分析（可选）：需在系统环境变量配置
  setx DASHSCOPE_API_KEY "sk-..."
  setx DEEPSEEK_API_KEY "sk-..."
  然后重启平台

三、常见问题
- 端口占用：前端从 3100 起自动探测，无需手动改
- 启动失败：查看 logs\frontend-error.log
- 解压乱码：用 7-Zip 重新解压
"@ | Set-Content -Path (Join-Path $Top "MIGRATION-NOTES.txt") -Encoding UTF8

# 6. Python zipfile 打包（UTF-8 文件名标志，避免中文路径乱码）
Write-Host "正在打包 zip（UTF-8 文件名标志）..."
$ZipPath = Join-Path $Root "release\fujian-housing-safety-portable-$Date.zip"
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
$env:PYTHONUTF8 = "1"
& py -3.13 (Join-Path $Root "make_portable_zip.py") $Stage $ZipPath 2>&1 | Select-Object -Last 3
if ($LASTEXITCODE -ne 0) { throw "zip 打包失败" }

# 清理 staging
Remove-Item -Recurse -Force $Stage
$size = [math]::Round((Get-Item $ZipPath).Length / 1MB)
Write-Host ""
Write-Host "便携版打包完成：$ZipPath" -ForegroundColor Green
Write-Host "大小：$size MB"
Write-Host ""
