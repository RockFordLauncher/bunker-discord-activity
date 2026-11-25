@echo off
chcp 65001 >nul
cd /d "d:\game"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Auto-update: sync latest changes"

echo [1/3] Проверка изменений...
git add .
git status -s

echo [2/3] Создание коммита...
git commit -m "%MSG%"
if errorlevel 1 (
    echo Нет новых изменений для отправки.
    pause
    exit /b 0
)

echo [3/3] Отправка на GitHub...
git push origin main
if errorlevel 0 (
    echo.
    echo ========================================
    echo  УСПЕШНО! Изменения отправлены на GitHub.
    echo  Render автоматически начал деплой новой версии.
    echo ========================================
) else (
    echo.
    echo [ОШИБКА] Не удалось отправить в GitHub. Проверьте подключение к сети.
)

pause
