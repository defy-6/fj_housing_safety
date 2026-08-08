#!/bin/zsh

# 福建省房屋安全动态监测平台：macOS 双击启动入口
# 自动避开 3000，从 3100 起选择可用端口；重复双击不会重复启动。

set -u

PROJECT_DIR="${0:A:h}"
WEB_DIR="$PROJECT_DIR/apps/web"
LOG_DIR="$PROJECT_DIR/runtime"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PID_FILE="$LOG_DIR/frontend.pid"
URL_FILE="$LOG_DIR/platform.url"
CACHE_LOCATION_FILE="$WEB_DIR/.project-location"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PLATFORM_START_PORT="${PLATFORM_START_PORT:-3100}"

mkdir -p "$LOG_DIR"

print ""
print "========================================"
print "  福建省房屋安全动态监测平台"
print "  正在检查并启动平台……"
print "========================================"
print ""

url_ready() {
  /usr/bin/curl -fsS --max-time 2 "$1" >/dev/null 2>&1
}

saved_url() {
  if [[ -f "$URL_FILE" ]]; then
    head -n 1 "$URL_FILE" | tr -d '[:space:]'
  fi
}

process_running() {
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  local saved_pid
  saved_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$saved_pid" ]] && kill -0 "$saved_pid" >/dev/null 2>&1
}

pause_before_exit() {
  if [[ -t 0 ]]; then
    read -k 1 "?按任意键关闭此窗口……"
    print ""
  fi
}

if process_running; then
  URL="$(saved_url)"
  if [[ -n "$URL" ]] && url_ready "$URL"; then
    print "✓ 平台已在运行，直接打开：$URL"
    open "$URL"
    print ""
    pause_before_exit
    exit 0
  fi
  print "• 检测到启动中的平台，正在等待服务就绪……"
  for i in {1..30}; do
    URL="$(saved_url)"
    if [[ -n "$URL" ]] && url_ready "$URL"; then
      open "$URL"
      print "✓ 平台已启动：$URL"
      print ""
      pause_before_exit
      exit 0
    fi
    /bin/sleep 1
  done
fi

NPM_BIN="$(command -v npm 2>/dev/null || true)"
NODE_BIN="$(command -v node 2>/dev/null || true)"
if [[ -z "$NPM_BIN" || -z "$NODE_BIN" ]]; then
  print "✗ 未找到 Node.js/npm，无法启动平台。"
  print ""
  pause_before_exit
  exit 1
fi

if [[ ! -x "$WEB_DIR/node_modules/.bin/vinext" ]]; then
  print "• 首次运行，正在安装平台依赖……"
  (cd "$WEB_DIR" && "$NPM_BIN" install) >>"$FRONTEND_LOG" 2>&1
  if [[ $? -ne 0 ]]; then
    print "✗ 依赖安装失败，请查看：$FRONTEND_LOG"
    print ""
    pause_before_exit
    exit 1
  fi
fi

# Vite/Vinext 会在缓存中记录项目绝对路径。项目被移动后自动刷新缓存，
# 避免继续引用迁移前目录中的模块。
CURRENT_PROJECT_LOCATION="$PROJECT_DIR"
SAVED_PROJECT_LOCATION=""
if [[ -f "$CACHE_LOCATION_FILE" ]]; then
  SAVED_PROJECT_LOCATION="$(head -n 1 "$CACHE_LOCATION_FILE" 2>/dev/null || true)"
fi
if [[ "$SAVED_PROJECT_LOCATION" != "$CURRENT_PROJECT_LOCATION" ]]; then
  print "• 检测到项目位置变化，正在刷新运行缓存……"
  rm -rf "$WEB_DIR/node_modules/.vite" "$WEB_DIR/.vinext" "$WEB_DIR/dist"
  print -r -- "$CURRENT_PROJECT_LOCATION" >"$CACHE_LOCATION_FILE"
fi

print "• 正在选择可用端口并启动平台……"
: >"$FRONTEND_LOG"
rm -f "$URL_FILE"
cd "$WEB_DIR" || exit 1
nohup "$NODE_BIN" scripts/start_web.mjs >>"$FRONTEND_LOG" 2>&1 &
print -r -- "$!" >"$PID_FILE"

URL=""
for i in {1..60}; do
  URL="$(saved_url)"
  if [[ -n "$URL" ]] && url_ready "$URL"; then
    break
  fi
  /bin/sleep 1
done

if [[ -z "$URL" ]] || ! url_ready "$URL"; then
  print "✗ 平台启动失败（60 秒内未就绪），请查看：$FRONTEND_LOG"
  print ""
  print "---------------- 日志末尾 ----------------"
  tail -n 30 "$FRONTEND_LOG"
  print "------------------------------------------"
  print ""
  pause_before_exit
  exit 1
fi

open "$URL"
print ""
print "========================================"
print "  平台已启动：$URL"
print "  已自动避开 3000 端口"
print "  此窗口关闭后平台仍会继续运行。"
print "  停止平台：kill \$(cat '$PID_FILE')"
print "========================================"
print ""
pause_before_exit
