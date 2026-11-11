param([string]$Checkpoint = 'work/fullbook-completion-audit-20261106/inventory-checkpoint.json',
  [string]$ImagePrefix = 'current-inventory-',
  [string]$OutputDirectory = 'work/fullbook-completion-audit-20261106')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$auditRoot = Join-Path $projectRoot $OutputDirectory
$state = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot $Checkpoint) | ConvertFrom-Json
$items = @($state.states)
$font = New-Object Drawing.Font('Consolas',14)
try {
  for ($offset = 0; $offset -lt $items.Count; $offset += 6) {
    $subset = @($items | Select-Object -Skip $offset -First 6)
    $rows = [Math]::Ceiling($subset.Count / 2)
    $bitmap = New-Object Drawing.Bitmap(1366,($rows * 478))
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([Drawing.Color]::FromArgb(244,240,230))
      $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      for ($index = 0; $index -lt $subset.Count; $index++) {
        $id = $subset[$index].id
        $source = [Drawing.Image]::FromFile((Join-Path $projectRoot "output/playwright/$ImagePrefix$id.png"))
        try {
          $x = ($index % 2) * 683
          $y = [Math]::Floor($index / 2) * 478
          $graphics.DrawString(('{0:D2}  {1}' -f ($offset+$index+1),$id),$font,[Drawing.Brushes]::Black,$x+10,$y+4)
          $graphics.DrawImage($source, [Drawing.Rectangle]::new($x,($y+28),683,450))
        } finally { $source.Dispose() }
      }
      $name = 'current-sheet-{0:D2}.jpg' -f ([int]($offset/6)+1)
      $bitmap.Save((Join-Path $auditRoot $name),[Drawing.Imaging.ImageFormat]::Jpeg)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
} finally { $font.Dispose() }
Write-Output "Contact sheets include $($items.Count) rendered models."
