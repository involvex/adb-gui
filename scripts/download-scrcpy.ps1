$ErrorActionPreference = 'Stop'

$apiUrl = 'https://api.github.com/repos/Genymobile/scrcpy/releases/latest'
$destDir = Join-Path $PSScriptRoot '..\electron\resources\win64'
$destSubDir = Join-Path $destDir 'scrcpy'
$zipPath = Join-Path $destDir 'scrcpy-win64.zip'

Write-Host "Fetching latest scrcpy release..."
$json = Invoke-RestMethod -Uri $apiUrl
$asset = $json.assets | Where-Object { $_.name -like 'scrcpy-win64-*.zip' }
if (-not $asset) {
    Write-Error 'scrcpy-win64 asset not found in latest release'
    exit 1
}

Write-Host "Downloading: $($asset.browser_download_url)"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

Write-Host "Extracting to $destSubDir"
if (Test-Path $destSubDir) {
    Remove-Item -Recurse -Force $destSubDir
}
Expand-Archive -Path $zipPath -DestinationPath $destSubDir -Force
Remove-Item $zipPath

Write-Host "Done! scrcpy files extracted to $destSubDir"
