# 打包"即插即用"迁移版本（Windows）
# 用法：powershell -ExecutionPolicy Bypass -File .\pack-migrate.ps1
# 产物：release\fujian-housing-safety-windows-<日期>.zip

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Date = Get-Date -Format "yyyyMMdd"
$Stage = Join-Path $Root "release\_stage"
$ZipName = "fujian-housing-safety-windows-$Date.zip"
$ZipPath = Join-Path $Root "release\$ZipName"

# 清空并重建 staging 目录
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null
if (-not (Test-Path (Join-Path $Root "release"))) { New-Item -ItemType Directory -Force -Path (Join-Path $Root "release") | Out-Null }

# 复制项目全部内容（排除本机专属/大缓存）
$exclude = @(
  ".git",
  "release",
  "runtime",
  "apps\web\node_modules\.cache",
  "apps\web\.wrangler",
  "apps\web\.vinext",
  "apps\web\.next",
  "apps\web\dist\.vite",
  "backend\.venv",
  "backend\outputs",
  "outputs"
)
robocopy $Root $Stage /E /NFL /NDL /NJH /NJS /NC /NS /XD $exclude | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 失败" }

# 补上被排除但仍需要的运行时文件（zip 内不排除它们）
# node_modules / dist / sqlite 已在复制中保留，无需额外处理

# 写入版本说明
@"
福建省房屋安全动态监测平台 - Windows 迁移包
打包日期：$(Get-Date -Format "yyyy-MM-dd HH:mm")
Git 提交：$(git -C $Root log -1 --format="%h %s" 2>$null)

使用方法：
1. 解压到任意目录（路径不要含中文/空格更稳妥）
2. 双击 start-platform.bat 启动
3. 浏览器自动打开 http://localhost:3100/
要求：Windows 10/11 + Node.js 22（本包已含 node_modules 与构建产物）
"@ | Set-Content -Path (Join-Path $Stage "MIGRATION-NOTES.txt") -Encoding UTF8

# 压缩
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path "$Stage\*" -DestinationPath $ZipPath -CompressionLevel Optimal

# 清理 staging
Remove-Item -Recurse -Force $Stage

$size = [math]::Round((Get-Item $ZipPath).Length / 1MB)
Write-Host ""
Write-Host "打包完成：$ZipPath"
Write-Host "大小：$size MB"
Write-Host ""
