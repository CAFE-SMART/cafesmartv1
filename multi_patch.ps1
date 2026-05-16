$f1='c:\Users\fcoib\cafesmartv1\frontend\src\pages\Ventas.tsx'
$c1=[System.IO.File]::ReadAllText($f1)
$c1=$c1.Replace('Registro de Venta','Nueva Venta')
$c1=$c1.Replace('Registro de venta','Nueva Venta')
[System.IO.File]::WriteAllText($f1,$c1)
Write-Host 'Done Ventas'