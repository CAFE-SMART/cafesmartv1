$repoRoot = $PSScriptRoot
$filepath = Join-Path $repoRoot "frontend/src/pages/Inicio.tsx"
$backup = "$filepath.bak"
Copy-Item -LiteralPath $filepath -Destination $backup -Force
$lines = Get-Content -LiteralPath $filepath
$n = $lines.Count
Write-Host "Archivo tiene $n lineas"
