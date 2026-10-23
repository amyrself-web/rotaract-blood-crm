<#
  Installs the CRM WhatsApp sender on Windows Server (2016, 2019, 2022, 2025) or Windows 10/11.
  It runs in the background as a scheduled task that starts with Windows and restarts itself if it stops.

  Open PowerShell as Administrator in this folder and run ONE of:
    .\install-windows.ps1                 # built-in engine (light, about 100 MB RAM)
    .\install-windows.ps1 -Engine openwa  # OpenWA with a hidden Chrome (lower ban risk, about 1 GB RAM)

  If Windows blocks the script:  Set-ExecutionPolicy -Scope Process Bypass -Force
  To remove:                     .\install-windows.ps1 -Uninstall
#>
param([ValidateSet('baileys','openwa')][string]$Engine='baileys',[switch]$Uninstall)
$ErrorActionPreference='Stop'
$Dir=$PSScriptRoot
$OwaDir=Join-Path $env:ProgramData 'crm-openwa'

function Say($t,$c='Cyan'){Write-Host $t -ForegroundColor $c}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  Say 'Please run PowerShell as Administrator (right-click > Run as administrator).' Red; exit 1}

if($Uninstall){
  foreach($t in 'CRM WhatsApp sender','CRM OpenWA'){if(Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue;Unregister-ScheduledTask -TaskName $t -Confirm:$false;Say "Removed task: $t"}}
  Get-NetFirewallRule -DisplayName 'CRM WhatsApp - block *' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Say 'Done. The WhatsApp login stays in the auth folder (or openwa data); delete it to unlink the phone.' Green; exit 0}

# ---------- Node.js and Git ----------
function NodeMajor{try{[int]((node -v) -replace '^v(\d+).*','$1')}catch{0}}
$need= if($Engine -eq 'openwa'){22}else{20}
if((NodeMajor) -lt $need -or -not (Get-Command git -ErrorAction SilentlyContinue)){
  if(Get-Command winget -ErrorAction SilentlyContinue){
    Say 'Installing Node.js LTS and Git with winget...'
    if((NodeMajor) -lt $need){winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements}
    if(-not (Get-Command git -ErrorAction SilentlyContinue)){winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements}
    $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
  }
  # no winget (common on Windows Server): download the official installers directly
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  $ProgressPreference='SilentlyContinue'
  if((NodeMajor) -lt $need){
    Say 'Downloading Node.js LTS...'
    $v=((Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts -and $_.version -like 'v22.*' } | Select-Object -First 1).version
    $msi=Join-Path $env:TEMP "node-$v-x64.msi"
    Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-x64.msi" -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait}
  if(-not (Get-Command git -ErrorAction SilentlyContinue)){
    Say 'Downloading Git for Windows...'
    $rel=Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{'User-Agent'='crm-installer'}
    $url=($rel.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1).browser_download_url
    $exe=Join-Path $env:TEMP 'git-setup.exe'
    Invoke-WebRequest $url -OutFile $exe
    Start-Process $exe -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP-' -Wait}
  $env:Path=[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')
  if((NodeMajor) -lt $need -or -not (Get-Command git -ErrorAction SilentlyContinue)){
    Say "Please install these first, then run this script again:" Yellow
    Say "  Node.js $need or newer (LTS, Windows Installer .msi): https://nodejs.org/en/download" Yellow
    Say "  Git for Windows: https://git-scm.com/download/win" Yellow
    exit 1}
}
$Node=(Get-Command node).Source; $Npm=(Get-Command npm.cmd).Source
Say "Node $(node -v), $(git --version)"

# ---------- settings (.env) ----------
$EnvFile=Join-Path $Dir '.env'
if(-not (Test-Path $EnvFile)){Copy-Item (Join-Path $Dir '.env.example') $EnvFile}
function SetEnv($k,$v){$lines=@(Get-Content $EnvFile);$i=[Array]::FindIndex([string[]]$lines,[Predicate[string]]{param($l) $l -match "^\s*#?\s*$k="})
  if($i -ge 0){$lines[$i]="$k=$v"}else{$lines+="$k=$v"};Set-Content -Path $EnvFile -Value $lines -Encoding ascii}
if(-not ((Get-Content $EnvFile) -match '^SUPABASE_SERVICE_ROLE_KEY=.{20,}')){
  $key=Read-Host 'Paste the Supabase secret (service role) key (Supabase > Project Settings > API keys)'
  SetEnv 'SUPABASE_SERVICE_ROLE_KEY' $key.Trim()}
SetEnv 'ENGINE' $Engine
# only Administrators and the system can read the key
icacls $EnvFile /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:F' | Out-Null

Say 'Installing the sender...'
Push-Location $Dir; & $Npm install --omit=dev --no-audit --no-fund; Pop-Location

function Add-CrmTask($Name,$WorkDir,$Cmd,$Log){
  # outer quotes are removed by cmd /s /c, leaving the quoted program path and log path intact
  $act=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/s /c `"$Cmd >> `"$Log`" 2>&1`"" -WorkingDirectory $WorkDir
  $trg=New-ScheduledTaskTrigger -AtStartup
  $pri=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $set=New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $Name -Action $act -Trigger $trg -Principal $pri -Settings $set -Force | Out-Null
  Start-ScheduledTask -TaskName $Name
  Say "Started: $Name (log: $Log)" Green}

# ---------- OpenWA (optional) ----------
if($Engine -eq 'openwa'){
  if(-not (Test-Path (Join-Path $OwaDir 'package.json'))){Say "Downloading OpenWA to $OwaDir..."; git clone --depth 1 https://github.com/rmyndharis/OpenWA.git $OwaDir}
  $owaEnv=Join-Path $OwaDir '.env'
  if(-not (Test-Path $owaEnv)){
    Copy-Item (Join-Path $OwaDir '.env.minimal') $owaEnv
    Add-Content $owaEnv "`nNODE_ENV=production`nAUTO_START_SESSIONS=true`nSSRF_ALLOWED_HOSTS=localhost,127.0.0.1`nSEND_PACING_ENABLED=true`nSIMULATE_TYPING=true`nTZ=Asia/Kolkata"}
  # OpenWA's database driver (better-sqlite3) is compiled on install, which needs the Visual Studio C++ build tools
  $vswhere="${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  function HasVC{(Test-Path $vswhere) -and [bool](& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)}
  if(-not (HasVC)){
    Say 'Installing Visual Studio C++ Build Tools (needed by OpenWA; about 3 GB, 10 to 20 minutes)...'
    $vsArgs='--quiet --wait --norestart --nocache --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
    if(Get-Command winget -ErrorAction SilentlyContinue){winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements --override $vsArgs}
    if(-not (HasVC)){$bt=Join-Path $env:TEMP 'vs_BuildTools.exe';Invoke-WebRequest 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile $bt;Start-Process $bt -ArgumentList $vsArgs -Wait}
    if(-not (HasVC)){Say 'Could not install the C++ build tools. Install "Build Tools for Visual Studio" with "Desktop development with C++" from https://visualstudio.microsoft.com/downloads/ and run this again.' Red; exit 1}}
  Stop-ScheduledTask -TaskName 'CRM OpenWA' -ErrorAction SilentlyContinue
  Say 'Building OpenWA (this takes a few minutes)...'
  Push-Location $OwaDir
  foreach($step in @('install --no-audit --no-fund','run dashboard:install','run build:all')){
    Say "  npm $step"
    # through cmd so npm's warnings on stderr do not stop PowerShell (Windows PowerShell 5.1 treats them as errors)
    # (a small .cmd file avoids PowerShell's quoting of paths with spaces)
    $bat=Join-Path $OwaDir 'crm-build.cmd'
    Set-Content -Path $bat -Encoding ascii -Value "@call `"$Npm`" $step >> build.log 2>&1`r`n@exit /b %errorlevel%"
    cmd.exe /c $bat
    if($LASTEXITCODE -ne 0){Pop-Location
      Say "OpenWA build failed at 'npm $step'. The full output is in $OwaDir\build.log" Red
      Say "Quick way out: .\install-windows.ps1 -Uninstall ; then .\install-windows.ps1   (built-in engine, no build needed)" Yellow; exit 1}}
  Pop-Location
  if(-not (Test-Path (Join-Path $OwaDir 'dist\main.js'))){Say "OpenWA build finished but dist\main.js is missing. See $OwaDir\build.log" Red; exit 1}
  Add-CrmTask 'CRM OpenWA' $OwaDir "`"$Node`" dist\main.js" (Join-Path $OwaDir 'openwa.log')
  Say 'Waiting for OpenWA to create its admin key...'
  $keyFile=Join-Path $OwaDir 'data\.api-key'; $t=0; while(-not (Test-Path $keyFile) -and $t -lt 120){Start-Sleep 2;$t+=2}
  if(-not (Test-Path $keyFile)){Say "OpenWA did not start. Look at $OwaDir\openwa.log" Red; exit 1}
  SetEnv 'OPENWA_URL' 'http://127.0.0.1:2785'
  SetEnv 'OPENWA_API_KEY_FILE' $keyFile
  SetEnv 'WEBHOOK_PUBLIC_URL' 'http://127.0.0.1:2790/openwa'
  SetEnv 'WEBHOOK_HOST' '127.0.0.1'
  # OpenWA and the webhook are for this computer only
  New-NetFirewallRule -DisplayName 'CRM WhatsApp - block OpenWA from the network' -Direction Inbound -Protocol TCP -LocalPort 2785 -RemoteAddress Any -Action Block -ErrorAction SilentlyContinue | Out-Null
  Say "OpenWA dashboard: http://localhost:2785  (admin key: $keyFile)"}

Add-CrmTask 'CRM WhatsApp sender' $Dir "`"$Node`" worker.mjs" (Join-Path $Dir 'worker.log')
Say ''
Say 'All set. Now open the CRM > WhatsApp and alerts > Connect > "Club phone, linked by QR",' Green
Say 'and scan the QR with the club phone: WhatsApp > Linked devices > Link a device.' Green
Say "Logs: Get-Content `"$Dir\worker.log`" -Wait -Tail 30"
