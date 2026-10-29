<#
  Checks the CRM WhatsApp sender on this Windows computer and starts it again.
  Open PowerShell as Administrator in this folder and run:
    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\check-sender.ps1
  It shows why the sender stopped (last lines of its log), copies the newest sender files from this folder,
  makes sure Windows restarts it every 5 minutes if it ever stops, and starts it.
#>
$ErrorActionPreference='Continue'
function Say($t,$c='Cyan'){Write-Host $t -ForegroundColor $c}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  Say 'Please run PowerShell as Administrator (right-click > Run as administrator).' Red; exit 1}

# first get the newest sender files from the CRM's GitHub (so an old download is never used)
$raw='https://raw.githubusercontent.com/amyrself-web/rotaract-blood-crm/main/whatsapp-worker/'
try{
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  foreach($f in 'worker.mjs','openwa.mjs'){ $tmp=Join-Path $env:TEMP "crm-$f"; Invoke-WebRequest ($raw+$f) -OutFile $tmp -UseBasicParsing; if((Get-Item $tmp).Length -gt 1000){ Copy-Item $tmp (Join-Path $PSScriptRoot $f) -Force } }
  $v=(Select-String -Path (Join-Path $PSScriptRoot 'worker.mjs') -Pattern "const VERSION='([\d.]+)'").Matches[0].Groups[1].Value
  Say "Downloaded the newest sender (version $v)." Green
}catch{ Say "Could not download the newest sender ($($_.Exception.Message)). Using the files in this folder." Yellow }

$tasks='CRM OpenWA','CRM WhatsApp sender'
$found=$false
foreach($name in $tasks){
  $t=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if(-not $t){ if($name -eq 'CRM WhatsApp sender'){Say "Task '$name' is not installed. Run .\install-windows.ps1 (add -Engine openwa if you used OpenWA)." Red}; continue }
  $found=$true
  $i=Get-ScheduledTaskInfo -TaskName $name
  Say ''
  Say "== $name" White
  Say ("   State: {0}   Last run: {1}   Last result: 0x{2:X}" -f $t.State,$i.LastRunTime,$i.LastTaskResult)
  $arg=$t.Actions[0].Arguments; $wd=$t.Actions[0].WorkingDirectory
  $log=([regex]::Matches($arg,'>> "([^"]+)"') | Select-Object -Last 1).Groups[1].Value
  if($log -and (Test-Path $log)){
    Say "   Last lines of $log :" DarkGray
    Get-Content $log -Tail 25 | ForEach-Object { Write-Host "     $_" }
  }

  # newest sender files from this folder (the task may point at an older download)
  if($name -eq 'CRM WhatsApp sender' -and $wd -and (Resolve-Path $wd -ErrorAction SilentlyContinue).Path -ne (Resolve-Path $PSScriptRoot).Path){
    foreach($f in 'worker.mjs','openwa.mjs'){ if(Test-Path (Join-Path $PSScriptRoot $f)){ Copy-Item (Join-Path $PSScriptRoot $f) (Join-Path $wd $f) -Force } }
    Say "   Updated the sender files in $wd" Green
  }

  # watchdog: every 5 minutes Windows starts it again if it is not running
  $hasRepeat=$t.Triggers | Where-Object { $_.Repetition -and $_.Repetition.Interval }
  if(-not $hasRepeat){
    $trg=@((New-ScheduledTaskTrigger -AtStartup),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)))
    Set-ScheduledTask -TaskName $name -Trigger $trg | Out-Null
    Say '   Added: restart by itself every 5 minutes if stopped' Green
  }
  $set=New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Set-ScheduledTask -TaskName $name -Settings $set | Out-Null

  if((Get-ScheduledTask -TaskName $name).State -ne 'Running'){
    Start-ScheduledTask -TaskName $name; Start-Sleep -Seconds 8
    Say ("   Started. State now: {0}" -f (Get-ScheduledTask -TaskName $name).State) Green
  } elseif($name -eq 'CRM WhatsApp sender'){
    Stop-ScheduledTask -TaskName $name; Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'worker\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2; Start-ScheduledTask -TaskName $name; Start-Sleep -Seconds 8
    Say '   Restarted with the newest files.' Green
  } else { Say '   Running.' Green }
}
if($found){
  powercfg /change standby-timeout-ac 0 2>$null; powercfg /change hibernate-timeout-ac 0 2>$null
  Say ''
  Say 'Done. In the CRM, WhatsApp and alerts > Connect should show "Connected" within a minute.' Green
  Say 'If it shows a QR code instead, scan it with the club phone: WhatsApp > Linked devices > Link a device.' Green
}
