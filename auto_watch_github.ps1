# Скрипт автоматического отслеживания изменений и отправки на GitHub
$path = "d:\game"
$filter = "*.*"

Write-Host "Автоматический вотчер запущен для $path..." -ForegroundColor Cyan
Write-Host "При сохранении любых файлов в проекте через 5 секунд тишины изменения сами отправятся на GitHub!" -ForegroundColor Yellow

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $path
$watcher.Filter = $filter
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

$lastAction = [DateTime]::MinValue
$lock = [object]::new()

$action = {
    param($source, $e)
    # Игнорируем изменения в .git
    if ($e.FullPath -match "\\\.git\\") { return }
    
    $global:pendingPush = $true
    $global:lastChangeTime = [DateTime]::Now
}

Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null
Register-ObjectEvent $watcher "Created" -Action $action | Out-Null
Register-ObjectEvent $watcher "Deleted" -Action $action | Out-Null

$global:pendingPush = $false
$global:lastChangeTime = [DateTime]::MinValue

while ($true) {
    Start-Sleep -Seconds 2
    if ($global:pendingPush -and (([DateTime]::Now - $global:lastChangeTime).TotalSeconds -ge 6)) {
        $global:pendingPush = $false
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Обнаружены изменения, отправляем на GitHub..." -ForegroundColor Green
        cd "d:\game"
        git add .
        $status = git status --porcelain
        if ($status) {
            git commit -m "Auto-sync $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            git push origin main
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Успешно отправлено! Render уже пересобирает игру." -ForegroundColor Cyan
        } else {
            Write-Host "Нет изменений для коммита." -ForegroundColor Gray
        }
    }
}
