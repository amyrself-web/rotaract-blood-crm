<#
  Keeps the WhatsApp sender computer awake and online, so messages go out without anyone opening Remote Desktop.
  Run ONCE in PowerShell as Administrator:
    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\keep-awake.ps1
  What it does:
    1. Never sleep or hibernate (plugged in, and on battery for laptops); closing a laptop lid does nothing.
    2. Network adapters are never switched off to save power; network stays on in standby.
    3. A small "stay awake" task (runs as SYSTEM from start-up) tells Windows the computer is busy, so it never idles to sleep.
    4. The sender task may wake the computer, and starts again by itself.
    5. Shows why and when the computer went to sleep before, so you can see it worked.
#>
$ErrorActionPreference='Continue'
function Say($t,$c='Cyan'){Write-Host $t -ForegroundColor $c}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  Say 'Please run PowerShell as Administrator (right-click > Run as administrator).' Red; exit 1}

Say '== Before: the last times this computer went to sleep / woke up' White
try{ Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';Id=42,107,506,507} -MaxEvents 6 -ErrorAction Stop |
  ForEach-Object { Write-Host ("   {0:dd MMM HH:mm}  {1}" -f $_.TimeCreated,($_.Message -split "`n")[0]) } }catch{ Say '   No sleep events found.' DarkGray }

Say '== 1. Power plan: never sleep' White
$hp='8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
if((powercfg /list) -match $hp){ powercfg /setactive $hp | Out-Null; Say '   High performance plan on' Green }
foreach($x in 'ac','dc'){
  powercfg /change "standby-timeout-$x" 0; powercfg /change "hibernate-timeout-$x" 0; powercfg /change "disk-timeout-$x" 0 }
powercfg /hibernate off 2>$null
$S='scheme_current'
foreach($m in '/setacvalueindex','/setdcvalueindex'){
  powercfg $m $S SUB_SLEEP STANDBYIDLE 0 2>$null          # sleep after: never
  powercfg $m $S SUB_SLEEP HYBRIDSLEEP 0 2>$null          # hybrid sleep: off
  powercfg $m $S SUB_SLEEP HIBERNATEIDLE 0 2>$null        # hibernate after: never
  powercfg $m $S SUB_SLEEP UNATTENDSLEEP 0 2>$null        # unattended sleep: never
  powercfg $m $S SUB_BUTTONS LIDACTION 0 2>$null          # closing the lid: do nothing
  powercfg $m $S SUB_NONE F15576E8-98B7-4186-B944-EAFA664402D9 1 2>$null   # network stays connected in standby
  powercfg $m $S 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 2>$null  # USB selective suspend: off
}
powercfg /setactive $S
Say '   Sleep, hibernate, hybrid sleep: off. Lid: do nothing. Network on in standby.' Green

Say '== 2. Network adapters: never switched off to save power' White
Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object {
  try{ Disable-NetAdapterPowerManagement -Name $_.Name -NoRestart -ErrorAction Stop; Say ("   {0}: power saving off" -f $_.Name) Green }
  catch{ Say ("   {0}: no power setting to change" -f $_.Name) DarkGray } }
# the classic "Allow the computer to turn off this device" tick box, for every network card
Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}' -ErrorAction SilentlyContinue | ForEach-Object {
  if((Get-ItemProperty $_.PSPath -Name NetCfgInstanceId -ErrorAction SilentlyContinue)){ Set-ItemProperty $_.PSPath -Name PnPCapabilities -Value 24 -Type DWord -ErrorAction SilentlyContinue } }

Say '== 3. Stay-awake task (tells Windows the computer is busy)' White
$dir=Join-Path $env:ProgramData 'CRM'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
$awake=Join-Path $dir 'stay-awake.ps1'
@'
Add-Type -Namespace Crm -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
while($true){ [Crm.Power]::SetThreadExecutionState(0x80000001) | Out-Null; Start-Sleep -Seconds 50 }   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
'@ | Set-Content -Path $awake -Encoding UTF8
$act=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$awake`""
$trg=@((New-ScheduledTaskTrigger -AtStartup),(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)))
$pri=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$set=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'CRM stay awake' -Action $act -Trigger $trg -Principal $pri -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName 'CRM stay awake'
Say '   "CRM stay awake" is running and starts with Windows.' Green

Say '== 4. Sender task: may wake the computer, restarts by itself, runs as SYSTEM' White
foreach($name in 'CRM WhatsApp sender','CRM OpenWA'){
  $t=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue; if(-not $t){continue}
  $s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
  Set-ScheduledTask -TaskName $name -Settings $s -Principal (New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest) | Out-Null
  if((Get-ScheduledTask -TaskName $name).State -ne 'Running'){ Start-ScheduledTask -TaskName $name }
  Say ("   {0}: {1}" -f $name,(Get-ScheduledTask -TaskName $name).State) Green }
if(-not (Get-ScheduledTask -TaskName 'CRM WhatsApp sender' -ErrorAction SilentlyContinue)){ Say '   Sender task not found. Run check-sender.ps1 (or install-windows.ps1) after this.' Yellow }

Say '== After' White
Write-Host '   Sleep states this computer supports:'; powercfg /a | Select-Object -First 8 | ForEach-Object { Write-Host "     $_" }
Write-Host '   Things keeping it awake now:'; powercfg /requests | Select-String -Pattern 'SYSTEM:' -Context 0,3 | ForEach-Object { Write-Host "     $_" }
Say ''
Say 'Done. You can close Remote Desktop: the computer stays awake and the sender keeps running.' Green
Say 'Leave the computer switched on and plugged in. If it is a laptop, the lid can be closed.' Green
