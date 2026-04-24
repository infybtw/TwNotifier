#!/bin/bash
set -e

# ─────────────────────────────────────────
#  TwNotifier installer
# ─────────────────────────────────────────

PROJECT_DIR="/opt/TwNotifier"
SERVICE_USER="tgbot"
SERVICE_NAME="twnotifier"
BUN_TARGET="/usr/local/bin/bun"

echo "==> Создаём системного пользователя $SERVICE_USER"
if id "$SERVICE_USER" &>/dev/null; then
    echo "    Пользователь уже существует, пропускаем"
else
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> Копируем bun в $BUN_TARGET"
BUN_PATH=$(which bun 2>/dev/null || echo "")
if [ -z "$BUN_PATH" ]; then
    # bun установлен через curl, лежит в /root/.bun/bin/bun
    BUN_PATH="/root/.bun/bin/bun"
fi

if [ ! -f "$BUN_PATH" ]; then
    echo "    bun не найден! Установи его: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

cp "$BUN_PATH" "$BUN_TARGET"
chmod 755 "$BUN_TARGET"

echo "==> Выставляем права на $PROJECT_DIR"

# Корень директории — root владеет, группа tgbot может создавать файлы (нужно для SQLite WAL)
chown root:$SERVICE_USER "$PROJECT_DIR"
chmod 770 "$PROJECT_DIR"

# Всё внутри — root:tgbot, только чтение для группы
chown -R root:$SERVICE_USER "$PROJECT_DIR"
chmod -R 750 "$PROJECT_DIR"

# .env — только чтение
chown root:$SERVICE_USER "$PROJECT_DIR/.env"
chmod 640 "$PROJECT_DIR/.env"

# logs — tgbot пишет
chown -R $SERVICE_USER:$SERVICE_USER "$PROJECT_DIR/logs"
chmod 750 "$PROJECT_DIR/logs"
touch "$PROJECT_DIR/logs/app.log"
chown $SERVICE_USER:$SERVICE_USER "$PROJECT_DIR/logs/app.log"
chmod 640 "$PROJECT_DIR/logs/app.log"

# main.db — tgbot пишет
chown $SERVICE_USER:$SERVICE_USER "$PROJECT_DIR/main.db"
chmod 640 "$PROJECT_DIR/main.db"

# .bun-cache — tgbot пишет
mkdir -p "$PROJECT_DIR/.bun-cache"
chown $SERVICE_USER:$SERVICE_USER "$PROJECT_DIR/.bun-cache"
chmod 750 "$PROJECT_DIR/.bun-cache"

# Восстанавливаем корень (770 нужен для SQLite)
chown root:$SERVICE_USER "$PROJECT_DIR"
chmod 770 "$PROJECT_DIR"

echo "==> Создаём systemd unit $SERVICE_NAME.service"
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=Twitch Notifier Bot
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
ExecStart=$BUN_TARGET run start
Restart=on-failure
RestartSec=5
Environment=BUN_INSTALL_CACHE_DIR=$PROJECT_DIR/.bun-cache

NoNewPrivileges=yes
ProtectSystem=full
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=$PROJECT_DIR/logs $PROJECT_DIR/main.db $PROJECT_DIR/.bun-cache

[Install]
WantedBy=multi-user.target
EOF

echo "==> Включаем и запускаем сервис"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo ""
echo "✓ Готово! Статус:"
systemctl status "$SERVICE_NAME" --no-pager
