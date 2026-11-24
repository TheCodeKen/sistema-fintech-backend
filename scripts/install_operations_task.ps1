param(
    [Parameter(Mandatory=$true)][string]$ConfigPath,
    [string]$Python = 'C:\Python\Python311\pythonw.exe'
)
$ErrorActionPreference = 'Stop'
$resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$repository = Split-Path -Parent $PSScriptRoot
$configuration = Get-Content -LiteralPath $resolvedConfig -Raw | ConvertFrom-Json
if ($configuration.project -notmatch '^[a-z0-9][a-z0-9_-]*$') { throw 'Invalid Compose project' }
if ((Split-Path -Leaf $Python) -ieq 'python.exe') { $Python = Join-Path (Split-Path -Parent $Python) 'pythonw.exe' }
if (!(Test-Path -LiteralPath $Python -PathType Leaf)) { throw 'Python executable not found' }
$taskName = 'FinTech-Operations-' + $configuration.project
$runner = Join-Path $PSScriptRoot 'operations.py'
$action = New-ScheduledTaskAction -Execute $Python -Argument ('"{0}" --config "{1}"' -f $runner,$resolvedConfig) -WorkingDirectory $repository
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 25) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
# Idempotent registration affects only this project's named task.
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Select-Object TaskName,State
