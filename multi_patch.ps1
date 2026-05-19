$repoRoot = $PSScriptRoot
$ventasPath = Join-Path $repoRoot "frontend/src/pages/Ventas.tsx"
$ventasContent = [System.IO.File]::ReadAllText($ventasPath)
$ventasContent = $ventasContent.Replace('Registro de Venta', 'Nueva Venta')
$ventasContent = $ventasContent.Replace('Registro de venta', 'Nueva Venta')
[System.IO.File]::WriteAllText($ventasPath, $ventasContent)
Write-Host 'Done Ventas'
