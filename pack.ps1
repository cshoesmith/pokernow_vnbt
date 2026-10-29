# Builds the shareable zip: dist\vNBT-Poker-<version>.zip from the extension folder and LICENSE.
# Run before every commit:  pwsh -File pack.ps1
$root = $PSScriptRoot
$version = (Get-Content "$root\extension\manifest.json" -Raw | ConvertFrom-Json).version
$zip = "$root\dist\vNBT-Poker-$version.zip"
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
if (Test-Path $zip) { Remove-Item $zip -Confirm:$false }
Compress-Archive -Path "$root\extension\*", "$root\LICENSE" -DestinationPath $zip   # MIT: the notice ships with copies
Write-Output "Packed $zip"
