param([string]$filePath, [int[]]$lineNumbers, [string[]]$newContents)
$lines = Get-Content $filePath
foreach ($i in 0..($lineNumbers.Length-1)) {
    $lines[$lineNumbers[$i]-1] = $newContents[$i]
}
$lines | Set-Content $filePath
