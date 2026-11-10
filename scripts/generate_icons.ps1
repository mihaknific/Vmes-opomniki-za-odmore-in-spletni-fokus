Add-Type -AssemblyName System.Drawing

function Create-AppIcon([int]$size, [string]$outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background gradient: Indigo to Deep Violet
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $cTop = [System.Drawing.Color]::FromArgb(255, 99, 102, 241)    # #6366f1
    $cBottom = [System.Drawing.Color]::FromArgb(255, 55, 48, 163)  # #3730a3
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)

    # Squircle with clean curvature
    $pad = [Math]::Max(0.5, [double]$size * 0.04)
    $w = [double]$size - 2 * $pad
    $radius = [double]$size * 0.22
    $dia = $radius * 2

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc([float]$pad, [float]$pad, [float]$dia, [float]$dia, 180, 90)
    $path.AddArc([float]($pad + $w - $dia), [float]$pad, [float]$dia, [float]$dia, 270, 90)
    $path.AddArc([float]($pad + $w - $dia), [float]($pad + $w - $dia), [float]$dia, [float]$dia, 0, 90)
    $path.AddArc([float]$pad, [float]($pad + $w - $dia), [float]$dia, [float]$dia, 90, 90)
    $path.CloseFigure()

    $g.FillPath($brush, $path)

    # Scale factor (base 128)
    $scale = [double]$size / 128.0

    # Golden clapper underneath
    $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
    $clapperR = [float](10.0 * $scale)
    $clapperX = [float](64.0 * $scale - $clapperR)
    $clapperY = [float](92.0 * $scale - $clapperR)
    $g.FillEllipse($goldBrush, $clapperX, $clapperY, [float]($clapperR * 2), [float]($clapperR * 2))

    # Bell Body & Handle (White)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $penHandle = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [float]([Math]::Max(1.6, 5.0 * $scale)))
    $penHandle.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $penHandle.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    
    # Top Handle Arc
    $g.DrawArc($penHandle, [float](57.0 * $scale), [float](22.0 * $scale), [float](14.0 * $scale), [float](14.0 * $scale), 180, 180)

    # Bell Body
    $bBody = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bBody.AddBezier([float](52 * $scale), [float](34 * $scale), [float](42 * $scale), [float](45 * $scale), [float](40 * $scale), [float](62 * $scale), [float](34 * $scale), [float](78 * $scale))
    $bBody.AddLine([float](34 * $scale), [float](78 * $scale), [float](94 * $scale), [float](78 * $scale))
    $bBody.AddBezier([float](94 * $scale), [float](78 * $scale), [float](88 * $scale), [float](62 * $scale), [float](86 * $scale), [float](45 * $scale), [float](76 * $scale), [float](34 * $scale))
    $bBody.CloseFigure()
    $g.FillPath($whiteBrush, $bBody)

    # Bell Lip / Rim
    $lipH = [float]([Math]::Max(1.5, 6.5 * $scale))
    $lipW = [float](70.0 * $scale)
    $lipX = [float](29.0 * $scale)
    $lipY = [float](77.0 * $scale)
    $lipRad = $lipH / 2.0

    $lipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $lipPath.AddArc($lipX, $lipY, $lipH, $lipH, 90, 180)
    $lipPath.AddArc([float]($lipX + $lipW - $lipH), $lipY, $lipH, $lipH, 270, 180)
    $lipPath.CloseFigure()
    $g.FillPath($whiteBrush, $lipPath)

    # Golden Chime Waves (Right side)
    $wavePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 251, 191, 36), [float]([Math]::Max(1.5, 4.5 * $scale)))
    $wavePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $wavePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    if ($size -ge 24) {
        $g.DrawArc($wavePen, [float](82.0 * $scale), [float](34.0 * $scale), [float](26.0 * $scale), [float](28.0 * $scale), -40, 80)
    }

    if ($size -ge 48) {
        $outerWavePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 251, 191, 36), [float](3.5 * $scale))
        $outerWavePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $outerWavePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $g.DrawArc($outerWavePen, [float](90.0 * $scale), [float](26.0 * $scale), [float](34.0 * $scale), [float](44.0 * $scale), -45, 90)
        $outerWavePen.Dispose()
    }

    # Save PNG
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    # Clean up
    $wavePen.Dispose()
    $lipPath.Dispose()
    $bBody.Dispose()
    $penHandle.Dispose()
    $whiteBrush.Dispose()
    $goldBrush.Dispose()
    $path.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

$base = "c:\Users\miha6865\Desktop\Projekti\2026-09-04-firefox-add-on-opomnik\extension\icons"
Create-AppIcon 16 "$base\icon-16.png"
Create-AppIcon 32 "$base\icon-32.png"
Create-AppIcon 48 "$base\icon-48.png"
Create-AppIcon 96 "$base\icon-96.png"
Create-AppIcon 128 "$base\icon-128.png"
Write-Host "Modern icons cleanly generated!"
