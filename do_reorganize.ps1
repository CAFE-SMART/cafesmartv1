$repoRoot = $PSScriptRoot
$filepath = Join-Path $repoRoot "frontend/src/pages/Inicio.tsx"
$backup = "$filepath.bak"
Copy-Item -LiteralPath $filepath -Destination $backup -Force
$lines = Get-Content -LiteralPath $filepath

# Find section boundaries
$idxResDia = -1; $idxCap = -1; $idxInv = -1; $idxEndInv = -1
$insideInv = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "Resumen del d") { $idxResDia = $i }
    if ($lines[$i] -match "Capacidad en bodega") { $idxCap = $i }
    if ($lines[$i] -match "Inventario en bodega") { $idxInv = $i }
    if ($idxInv -gt 0 -and $i -gt $idxInv) {
        if ($lines[$i] -match "<section") { $insideInv = $true }
        if ($insideInv -and $lines[$i] -match "^\s*</section>") { $idxEndInv = $i; break }
    }
}

# Get sections
$beforeAll = $lines[0..($idxResDia - 3)]
$resumenDia = $lines[($idxResDia - 1)..($idxCap - 3)]
$capacidad = $lines[($idxCap - 1)..($idxInv - 3)]
$inventario = $lines[($idxInv - 1)..($idxEndInv)]
$afterAll = $lines[($idxEndInv + 1)..($lines.Count - 1)]

# Reorder: Inventario first, then Capacidad, then Resumen del dia
$result = @()
$result += $beforeAll
$result += $inventario
$result += $capacidad
$result += $resumenDia
$result += $afterAll

$result | Set-Content -LiteralPath $filepath -Encoding UTF8
Write-Host "Reorganizado! Resumen en linea"
