param([string]$dir)
Remove-Item "$dir\spmp.pdf" -ErrorAction SilentlyContinue
$word = New-Object -ComObject Word.Application; $word.Visible = $false
$doc = $word.Documents.Open("$dir\SPMP-build.docx", $false, $true)
$doc.ExportAsFixedFormat("$dir\spmp.pdf", 17); $doc.Close($false)
try { $word.Quit() } catch {}
