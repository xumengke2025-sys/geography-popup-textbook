param([string]$Report,[string]$Prefix,[string]$Destination,[int]$PerSheet=6)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root=Split-Path -Parent $PSScriptRoot
$items=@((Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root $Report)|ConvertFrom-Json).states)
$outputRoot=Join-Path $root $Destination
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$font=New-Object Drawing.Font('Consolas',14)
try {
 for($offset=0;$offset -lt $items.Count;$offset+=$PerSheet){
  $subset=@($items|Select-Object -Skip $offset -First $PerSheet)
  $bitmap=New-Object Drawing.Bitmap(1366,([int][Math]::Ceiling($subset.Count/2)*478))
  $g=[Drawing.Graphics]::FromImage($bitmap)
  try {
   $g.Clear([Drawing.Color]::FromArgb(244,240,230))
   $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
   for($i=0;$i -lt $subset.Count;$i++){
    $name=$subset[$i].name
    $img=[Drawing.Image]::FromFile((Join-Path $root "output/playwright/$Prefix$name.png"))
    try {
     $x=($i%2)*683;$y=[int][Math]::Floor($i/2)*478
     $g.DrawString($name,$font,[Drawing.Brushes]::Black,$x+10,$y+4)
     $scale=[Math]::Min(683/$img.Width,450/$img.Height)
     $w=[int]($img.Width*$scale);$h=[int]($img.Height*$scale)
     $g.DrawImage($img,[Drawing.Rectangle]::new(($x+[int]((683-$w)/2)),($y+28),$w,$h))
    } finally {$img.Dispose()}
   }
   $bitmap.Save((Join-Path $outputRoot ('sheet-{0:D2}.jpg' -f ([int]($offset/$PerSheet)+1))),[Drawing.Imaging.ImageFormat]::Jpeg)
  } finally {$g.Dispose();$bitmap.Dispose()}
 }
} finally {$font.Dispose()}
Write-Output "Contact sheets: $($items.Count) rendered states."
