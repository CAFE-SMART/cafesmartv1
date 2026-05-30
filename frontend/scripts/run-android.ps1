param(
  [string]$AvdName = "CafeSmart_Pixel_5",
  [string]$TargetId = "emulator-5554",
  [int]$BootTimeoutSeconds = 300,
  [switch]$ForceWebBuild,
  [switch]$ForceGradleBuild,
  [switch]$LaunchOnly
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Message,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
  & $Action
}

function Get-LatestWriteTime {
  param([string[]]$Paths)

  $latest = $null

  foreach ($path in $Paths) {
    if (-not (Test-Path $path)) {
      continue
    }

    $items = Get-ChildItem -Path $path -Recurse -File -Force -ErrorAction SilentlyContinue
    foreach ($item in $items) {
      if ($null -eq $latest -or $item.LastWriteTimeUtc -gt $latest) {
        $latest = $item.LastWriteTimeUtc
      }
    }
  }

  return $latest
}

function Test-AdbDeviceReady {
  param([string]$AdbPath, [string]$DeviceId)

  try {
    $devices = & $AdbPath devices
    return ($devices -join "`n") -match "(?m)^$([regex]::Escape($DeviceId))\s+device\b"
  } catch {
    return $false
  }
}

function Resolve-CommandPath {
  param(
    [string]$CommandName,
    [string]$InstallHint
  )

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "No encontre $CommandName. $InstallHint"
}

function Resolve-AndroidTool {
  param(
    [string]$RelativePath,
    [string]$ToolName
  )

  $localAppDataSdk = if ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA "Android\Sdk"
  } else {
    $null
  }

  $sdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    $localAppDataSdk
  ) | Where-Object { $_ -and $_.Trim() }

  foreach ($sdkRoot in $sdkCandidates) {
    $toolPath = Join-Path $sdkRoot $RelativePath
    if (Test-Path $toolPath) {
      return $toolPath
    }
  }

  throw "No encontre $ToolName. Instala Android Studio/SDK o define ANDROID_HOME apuntando al SDK de Android."
}

function Get-ConnectedEmulatorId {
  param([string]$AdbPath)

  try {
    $devices = & $AdbPath devices
  } catch {
    return $null
  }

  foreach ($line in $devices) {
    if ($line -match "^(emulator-\d+)\s+device\b") {
      return $matches[1]
    }
  }

  return $null
}

function Wait-ForAdbDevice {
  param(
    [string]$AdbPath,
    [string]$PreferredDeviceId,
    [int]$TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    if (Test-AdbDeviceReady -AdbPath $AdbPath -DeviceId $PreferredDeviceId) {
      return $PreferredDeviceId
    }

    $connectedEmulator = Get-ConnectedEmulatorId -AdbPath $AdbPath
    if ($connectedEmulator) {
      Write-Host "Detectado $connectedEmulator; usando ese emulador para continuar." -ForegroundColor DarkCyan
      return $connectedEmulator
    }

    Start-Sleep -Seconds 3
  }

  throw "ADB no detecto un emulador listo dentro de $TimeoutSeconds segundos."
}

function Restart-AdbServer {
  param([string]$AdbPath)

  try {
    & $AdbPath kill-server | Out-Null
  } catch {
    Write-Host "ADB ya estaba detenido." -ForegroundColor DarkCyan
  }

  Start-Sleep -Seconds 2

  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      & $AdbPath start-server | Out-Null
      & $AdbPath devices | Out-Null
      return
    } catch {
      if ($attempt -eq 3) {
        throw
      }

      Write-Host "ADB no respondio en el intento $attempt; reintentando..." -ForegroundColor Yellow
      Start-Sleep -Seconds 3
    }
  }
}

function Wait-ForBootComplete {
  param(
    [string]$AdbPath,
    [string]$DeviceId,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $bootCompleted = (& $AdbPath -s $DeviceId shell getprop sys.boot_completed 2>$null).Trim()
      $bootAnim = (& $AdbPath -s $DeviceId shell getprop init.svc.bootanim 2>$null).Trim()

      if ($bootCompleted -eq "1" -and $bootAnim -eq "stopped") {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }

    Start-Sleep -Seconds 3
  }

  throw "El emulador no termino de arrancar dentro de $TimeoutSeconds segundos."
}

function Clear-AndroidLocks {
  $androidDir = Join-Path $env:USERPROFILE ".android"
  if (Test-Path $androidDir) {
    Get-ChildItem -Path $androidDir -Filter "*.lock" -Recurse -Force -ErrorAction SilentlyContinue |
      ForEach-Object {
        if ($_.PSIsContainer) {
          Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        } else {
          Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        }
      }
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectRoot "android"
$distDir = Join-Path $projectRoot "dist"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$androidAssetsDir = Join-Path $androidDir "app\src\main\assets\public"
$nodePath = Resolve-CommandPath -CommandName "node" -InstallHint "Instala Node.js antes de correr Android."
$pnpmPath = Resolve-CommandPath -CommandName "pnpm" -InstallHint "Instala pnpm con corepack enable o npm i -g pnpm."
$adbPath = Resolve-AndroidTool -RelativePath "platform-tools\adb.exe" -ToolName "adb"
$emulatorPath = Resolve-AndroidTool -RelativePath "emulator\emulator.exe" -ToolName "el emulador de Android"

$webSources = @(
  (Join-Path $projectRoot "src"),
  (Join-Path $projectRoot "public"),
  (Join-Path $projectRoot "package.json"),
  (Join-Path $projectRoot "vite.config.ts"),
  (Join-Path $projectRoot "vite.config.js"),
  (Join-Path $projectRoot "capacitor.config.ts")
)

$gradleSources = @(
  $distDir,
  (Join-Path $androidDir "app\src"),
  (Join-Path $androidDir "build.gradle"),
  (Join-Path $androidDir "app\build.gradle"),
  (Join-Path $androidDir "settings.gradle"),
  (Join-Path $androidDir "gradle.properties")
)

Push-Location $projectRoot

try {
  Invoke-Step "Verificando herramientas locales" {
    & $nodePath --version
    & $pnpmPath --version
    & $adbPath version | Select-Object -First 1
  }

  Invoke-Step "Limpiando locks viejos de Android" {
    Clear-AndroidLocks
  }

  Invoke-Step "Reiniciando ADB" {
    Restart-AdbServer -AdbPath $adbPath
  }

  $connectedTarget = Get-ConnectedEmulatorId -AdbPath $adbPath
  if ($connectedTarget -and -not (Test-AdbDeviceReady -AdbPath $adbPath -DeviceId $TargetId)) {
    Write-Host ""
    Write-Host "==> Usando emulador ya conectado: $connectedTarget" -ForegroundColor DarkCyan
    $TargetId = $connectedTarget
  }

  if (-not (Test-AdbDeviceReady -AdbPath $adbPath -DeviceId $TargetId)) {
    Invoke-Step "Abriendo el emulador $AvdName" {
      Start-Process -FilePath $emulatorPath -ArgumentList @(
        "-avd",
        $AvdName,
        "-no-snapshot-load",
        "-gpu",
        "swiftshader_indirect"
      ) | Out-Null
    }

    $detectedTargetId = Invoke-Step "Esperando a que ADB detecte el emulador" {
      Wait-ForAdbDevice -AdbPath $adbPath -PreferredDeviceId $TargetId
    }

    if ($detectedTargetId) {
      $TargetId = $detectedTargetId
    }
  }

  Invoke-Step "Esperando a que Android termine de arrancar" {
    Wait-ForBootComplete -AdbPath $adbPath -DeviceId $TargetId -TimeoutSeconds $BootTimeoutSeconds
  }

  Invoke-Step "Desbloqueando el emulador" {
    & $adbPath -s $TargetId shell input keyevent KEYCODE_WAKEUP | Out-Null
    & $adbPath -s $TargetId shell wm dismiss-keyguard | Out-Null
  }

  if (-not $LaunchOnly) {
    $latestWebSource = Get-LatestWriteTime -Paths $webSources
    $latestDistFile = Get-LatestWriteTime -Paths @($distDir)
    $needsWebBuild =
      $ForceWebBuild -or
      -not (Test-Path $distDir) -or
      $null -eq $latestDistFile -or
      ($null -ne $latestWebSource -and $latestWebSource -gt $latestDistFile)

    if ($needsWebBuild) {
      Invoke-Step "Compilando frontend para Android" {
        & $pnpmPath build:android
      }
    } else {
      Write-Host ""
      Write-Host "==> Reutilizando dist existente" -ForegroundColor DarkCyan
    }

    $latestDistAfterBuild = Get-LatestWriteTime -Paths @($distDir)
    $latestAndroidAssets = Get-LatestWriteTime -Paths @($androidAssetsDir)
    $needsCapCopy =
      $needsWebBuild -or
      -not (Test-Path $androidAssetsDir) -or
      $null -eq $latestAndroidAssets -or
      ($null -ne $latestDistAfterBuild -and $latestDistAfterBuild -gt $latestAndroidAssets)

    if ($needsCapCopy) {
      Invoke-Step "Sincronizando Capacitor Android" {
        & $pnpmPath exec cap sync android
      }
    } else {
      Write-Host ""
      Write-Host "==> Reutilizando assets Android existentes" -ForegroundColor DarkCyan
    }

    $latestGradleSource = Get-LatestWriteTime -Paths $gradleSources
    $apkTime = if (Test-Path $apkPath) { (Get-Item $apkPath).LastWriteTimeUtc } else { $null }
    $needsGradleBuild =
      $ForceGradleBuild -or
      -not (Test-Path $apkPath) -or
      $null -eq $apkTime -or
      ($null -ne $latestGradleSource -and $latestGradleSource -gt $apkTime)

    if ($needsGradleBuild) {
      Invoke-Step "Compilando APK debug" {
        Push-Location $androidDir
        try {
          .\gradlew.bat assembleDebug --console=plain
        } finally {
          Pop-Location
        }
      }
    } else {
      Write-Host ""
      Write-Host "==> Reutilizando APK debug existente" -ForegroundColor DarkCyan
    }

    if (-not (Test-Path $apkPath)) {
      throw "No encontre el APK en $apkPath"
    }

    if ($needsGradleBuild) {
      Invoke-Step "Instalando APK en $TargetId" {
        & $adbPath -s $TargetId install -r $apkPath
      }
    } else {
      Write-Host ""
      Write-Host "==> Saltando instalacion del APK porque no hubo cambios nativos ni web" -ForegroundColor DarkCyan
    }
  }

  Invoke-Step "Abriendo Cafe Smart" {
    & $adbPath -s $TargetId shell am force-stop com.cafesmart.app | Out-Null
    & $adbPath -s $TargetId shell am start -n com.cafesmart.app/.MainActivity
  }

  Write-Host ""
  Write-Host "Cafe Smart quedo abierto en $TargetId." -ForegroundColor Green
} finally {
  Pop-Location
}
