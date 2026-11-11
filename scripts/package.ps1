$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stageOnly = $args -contains '-StageOnly'
$releaseRoot = Join-Path $projectRoot 'release'
$offlineRoot = Join-Path $releaseRoot '地球现场_离线版'

# Compress-Archive opens input files exclusively on some Windows versions.
# Vite may legitimately still be reading public assets; share those reads and
# finish each archive in a temporary file before replacing its delivery copy.
function Compress-SharedArchive {
  param([string[]]$Sources, [string]$DestinationPath)
  Add-Type -AssemblyName System.IO.Compression
  $temporaryPath = $DestinationPath + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
  $targetStream = $null
  $archive = $null
  try {
    $targetStream = [IO.File]::Open($temporaryPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $archive = New-Object IO.Compression.ZipArchive($targetStream, [IO.Compression.ZipArchiveMode]::Create, $true)
    foreach ($sourcePath in $Sources) {
      $sourceItem = Get-Item -LiteralPath $sourcePath
      $baseDirectory = Split-Path -Parent $sourceItem.FullName
      $sourceFiles = if ($sourceItem.PSIsContainer) { @(Get-ChildItem -LiteralPath $sourceItem.FullName -Recurse -File -Force) } else { @($sourceItem) }
      foreach ($sourceFile in $sourceFiles) {
        $entryName = $sourceFile.FullName.Substring($baseDirectory.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
        $inputStream = $null
        $entryStream = $null
        try {
          $inputStream = [IO.File]::Open($sourceFile.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
          $entryStream = $entry.Open()
          $inputStream.CopyTo($entryStream)
        } finally {
          if ($entryStream) { $entryStream.Dispose() }
          if ($inputStream) { $inputStream.Dispose() }
        }
      }
    }
    $archive.Dispose()
    $archive = $null
    $targetStream.Dispose()
    $targetStream = $null
    Move-Item -LiteralPath $temporaryPath -Destination $DestinationPath -Force
  } finally {
    if ($archive) { $archive.Dispose() }
    if ($targetStream) { $targetStream.Dispose() }
    if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath -Force }
  }
}

New-Item -ItemType Directory -Force $offlineRoot,(Join-Path $offlineRoot 'runtime') | Out-Null
$distTarget = Join-Path $offlineRoot 'dist'
if (Test-Path -LiteralPath $distTarget) {
  $resolvedTarget = (Resolve-Path -LiteralPath $distTarget).Path
  if (-not $resolvedTarget.StartsWith($offlineRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Build path outside release directory' }
  Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination $offlineRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server.mjs') -Destination $offlineRoot -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'launch.cmd') -Destination (Join-Path $offlineRoot '打开地球现场.cmd') -Force
$runtimeSource = (Get-Command node).Source
$runtimeTarget = Join-Path $offlineRoot 'runtime/node.exe'
if (-not (Test-Path -LiteralPath $runtimeTarget) -or ((Get-FileHash -LiteralPath $runtimeSource).Hash -ne (Get-FileHash -LiteralPath $runtimeTarget).Hash)) {
  Copy-Item -LiteralPath $runtimeSource -Destination $runtimeTarget -Force
}
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/离线使用说明.txt') -Destination $offlineRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/THIRD_PARTY_NOTICES.txt') -Destination $offlineRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/THREE-LICENSE.txt') -Destination $offlineRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/NODE-LICENSE.txt') -Destination (Join-Path $offlineRoot 'runtime/LICENSE.txt') -Force
New-Item -ItemType Directory -Force (Join-Path $offlineRoot 'docs') | Out-Null
foreach ($documentName in @('教师说明.md','来源与实现说明.md','原作代码研究.md','整册覆盖表.md','验收记录.md','工作台改版说明.md','逐项体验复核_20261106.md')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot ('docs/' + $documentName)) -Destination (Join-Path $offlineRoot 'docs') -Force
}
$verificationSource = Join-Path $projectRoot 'docs/verification'
if (Test-Path -LiteralPath $verificationSource) {
  Copy-Item -LiteralPath $verificationSource -Destination (Join-Path $offlineRoot 'docs') -Recurse -Force
}
if ($stageOnly) {
  Write-Output "Offline directory staged: $offlineRoot"
  exit 0
}
Compress-SharedArchive -Sources @($offlineRoot) -DestinationPath (Join-Path $releaseRoot '地球现场_离线版.zip')
$sourcePaths = @('src','public','scripts','tests','docs','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','playwright.config.ts','README.md','CHECKPOINT.md') | ForEach-Object { Join-Path $projectRoot $_ }
Compress-SharedArchive -Sources $sourcePaths -DestinationPath (Join-Path $releaseRoot '人教版地理必修一_源工程_20261106.zip')
Compress-SharedArchive -Sources @((Join-Path $projectRoot 'dist')) -DestinationPath (Join-Path $releaseRoot '地球现场_静态网站.zip')
Get-ChildItem -LiteralPath $releaseRoot -Filter '*.zip' | Select-Object Name,Length

