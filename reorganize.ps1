$filepath = 'c:\Users\fcoib\cafesmartv1\frontend\src\pages\Inicio.tsx'
$backup = $filepath + '.bak'
Copy-Item $filepath $backup -Force
$lines = Get-Content $filepath
$n = $lines.Count
Write-Host "Archivo tiene $n lineas"
