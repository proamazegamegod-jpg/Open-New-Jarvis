param(
  [string[]]$ArgsList
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $repoRoot "src\services\stt_server.py"

$python = $env:STT_PYTHON
if (-not $python) {
  $voiceRoot = "C:\Users\asus\Desktop\voice_pc"
  $candidates = @(
    (Join-Path $voiceRoot ".venv\Scripts\python.exe"),
    (Join-Path $voiceRoot "venv\Scripts\python.exe"),
    (Join-Path $voiceRoot "env\Scripts\python.exe"),
    "C:\Users\asus\miniconda3\envs\voice-control\python.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      $python = $candidate
      break
    }
  }
}

if (-not $python) {
  $python = "python"
}

& $python $serverPath @ArgsList
