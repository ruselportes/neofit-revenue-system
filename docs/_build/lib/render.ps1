param([string]$docx, [string]$pdf)
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open($docx, $false, $true)
$doc.ExportAsFixedFormat($pdf, 17)
$doc.Close($false)
try { $word.Quit() } catch {}
