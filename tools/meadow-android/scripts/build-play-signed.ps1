$ErrorActionPreference = 'Stop'
$vault194 = Join-Path $env:USERPROFILE '.codex/private/meadow-markets-play'
$key194 = Join-Path $vault194 'upload.p12'
$password194 = Join-Path $vault194 'upload-password.dpapi'
if (-not (Test-Path -LiteralPath $vault194)) {
    New-Item -ItemType Directory -Path $vault194 | Out-Null
    $identity194 = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $vault194 /inheritance:r /grant:r ('{0}:(OI)(CI)F' -f $identity194) 'SYSTEM:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not protect the private signing folder.' }
}
if ((Test-Path -LiteralPath $key194) -ne (Test-Path -LiteralPath $password194)) { throw 'Signing vault is incomplete; recover it before building.' }
$keytool194 = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr/bin/keytool.exe'
if (-not (Test-Path -LiteralPath $keytool194)) { $keytool194 = (Get-Command keytool).Source }
try {
    if (-not (Test-Path -LiteralPath $key194)) {
        $random194 = New-Object byte[] 48
        $rng194 = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng194.GetBytes($random194)
        $rng194.Dispose()
        $plain194 = [Convert]::ToBase64String($random194)
        $secure194 = ConvertTo-SecureString $plain194 -AsPlainText -Force
        ConvertFrom-SecureString $secure194 | Set-Content -LiteralPath $password194 -Encoding ascii
        $env:MEADOW_UPLOAD_STORE_PASSWORD = $plain194
        $env:MEADOW_UPLOAD_KEY_PASSWORD = $plain194
        & $keytool194 -genkeypair -storetype PKCS12 -keystore $key194 -alias meadow-upload -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Fairplay Gaming, O=Fairplay Gaming, C=AU' -storepass:env MEADOW_UPLOAD_STORE_PASSWORD -keypass:env MEADOW_UPLOAD_KEY_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Upload signing key creation failed.' }
        $plain194 = $null
    } else {
        $secure194 = (Get-Content -LiteralPath $password194 -Raw).Trim() | ConvertTo-SecureString
        $pointer194 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure194)
        try { $env:MEADOW_UPLOAD_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer194) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer194) }
        $env:MEADOW_UPLOAD_KEY_PASSWORD = $env:MEADOW_UPLOAD_STORE_PASSWORD
    }
    $env:MEADOW_UPLOAD_KEYSTORE = $key194
    $env:MEADOW_UPLOAD_KEY_ALIAS = 'meadow-upload'
    $project194 = Split-Path $PSScriptRoot -Parent
    Push-Location $project194
    try {
        & npm.cmd run android:bundle
        if ($LASTEXITCODE -ne 0) { throw 'Signed Play bundle build failed.' }
        $evidence194 = 'D:/Chat Gpt/workspaces/meadow-production194-evidence'
        New-Item -ItemType Directory -Path $evidence194 -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $project194 'android/app/build/outputs/bundle/playRelease/app-play-release.aab') -Destination (Join-Path $evidence194 'meadow-markets-1.7.0-internal.aab')
        & $keytool194 -exportcert -rfc -keystore $key194 -alias meadow-upload -storepass:env MEADOW_UPLOAD_STORE_PASSWORD -file (Join-Path $evidence194 'upload-certificate.pem')
        if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
        Get-FileHash -LiteralPath (Join-Path $evidence194 'meadow-markets-1.7.0-internal.aab') -Algorithm SHA256
    } finally { Pop-Location }
} finally {
    Remove-Item Env:MEADOW_UPLOAD_STORE_PASSWORD,Env:MEADOW_UPLOAD_KEY_PASSWORD,Env:MEADOW_UPLOAD_KEYSTORE,Env:MEADOW_UPLOAD_KEY_ALIAS -ErrorAction SilentlyContinue
}
