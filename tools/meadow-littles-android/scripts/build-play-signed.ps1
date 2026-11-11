param([ValidateSet('acceptance','play')][string]$Distribution = 'acceptance')
$ErrorActionPreference = 'Stop'
$littlesVault = Join-Path $env:USERPROFILE '.codex/private/meadow-littles-play'
$littlesKey = Join-Path $littlesVault 'upload.p12'
$littlesPassword = Join-Path $littlesVault 'upload-password.dpapi'
New-Item -ItemType Directory -Path $littlesVault -Force | Out-Null
$littlesIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls $littlesVault /inheritance:r /grant:r ('{0}:(OI)(CI)F' -f $littlesIdentity) 'SYSTEM:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect the Littles signing vault.' }
if ((Test-Path -LiteralPath $littlesKey) -ne (Test-Path -LiteralPath $littlesPassword)) { throw 'Recover the incomplete Littles signing vault before building.' }
$littlesKeytool = Join-Path $env:ProgramFiles 'Android/Android Studio/jbr/bin/keytool.exe'
if (-not (Test-Path -LiteralPath $littlesKeytool)) { $littlesKeytool = (Get-Command keytool).Source }
$littlesProject = Split-Path $PSScriptRoot -Parent
try {
    if (-not (Test-Path -LiteralPath $littlesKey)) {
        $littlesRandom = New-Object byte[] 48
        $littlesRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $littlesRng.GetBytes($littlesRandom)
        $littlesRng.Dispose()
        $littlesPlain = [Convert]::ToBase64String($littlesRandom)
        $littlesSecure = ConvertTo-SecureString $littlesPlain -AsPlainText -Force
        ConvertFrom-SecureString $littlesSecure | Set-Content -LiteralPath $littlesPassword -Encoding ascii
        $env:LITTLES_UPLOAD_STORE_PASSWORD = $littlesPlain
        $env:LITTLES_UPLOAD_KEY_PASSWORD = $littlesPlain
        & $littlesKeytool -genkeypair -storetype PKCS12 -keystore $littlesKey -alias littles-upload -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Fairplay Gaming, O=Fairplay Gaming, C=AU' -storepass:env LITTLES_UPLOAD_STORE_PASSWORD -keypass:env LITTLES_UPLOAD_KEY_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Littles upload key generation failed.' }
        $littlesPlain = $null
    } else {
        $littlesSecure = (Get-Content -LiteralPath $littlesPassword -Raw).Trim() | ConvertTo-SecureString
        $littlesPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($littlesSecure)
        try { $env:LITTLES_UPLOAD_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($littlesPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($littlesPointer) }
        $env:LITTLES_UPLOAD_KEY_PASSWORD = $env:LITTLES_UPLOAD_STORE_PASSWORD
    }
    $env:LITTLES_UPLOAD_KEYSTORE = $littlesKey
    $env:LITTLES_UPLOAD_KEY_ALIAS = 'littles-upload'
    if ($Distribution -eq 'play') {
        $littlesConfig = Get-Content -LiteralPath (Join-Path $littlesProject 'play-config.json') -Raw | ConvertFrom-Json
        if ($littlesConfig.package -ne 'com.meadowmarket.littles') { throw 'Wrong app configuration.' }
        $env:LITTLES_ADMOB_APP_ID = $littlesConfig.admobAppId
        $env:LITTLES_BANNER_AD_UNIT = $littlesConfig.bannerAdUnit
    }
    Push-Location $littlesProject
    try {
        & npm.cmd run ('android:bundle:' + $Distribution)
        if ($LASTEXITCODE -ne 0) { throw 'Littles signed bundle failed.' }
        $littlesBundle = Join-Path $littlesProject ('android/app/build/outputs/bundle/{0}Release/app-{0}-release.aab' -f $Distribution)
        & $littlesKeytool -exportcert -rfc -keystore $littlesKey -alias littles-upload -storepass:env LITTLES_UPLOAD_STORE_PASSWORD -file (Join-Path $littlesVault 'upload-certificate.pem')
        if ($LASTEXITCODE -ne 0) { throw 'Littles certificate export failed.' }
        Get-FileHash -LiteralPath $littlesBundle -Algorithm SHA256
    } finally { Pop-Location }
} finally {
    Remove-Item Env:LITTLES_UPLOAD_STORE_PASSWORD,Env:LITTLES_UPLOAD_KEY_PASSWORD,Env:LITTLES_UPLOAD_KEYSTORE,Env:LITTLES_UPLOAD_KEY_ALIAS,Env:LITTLES_ADMOB_APP_ID,Env:LITTLES_BANNER_AD_UNIT -ErrorAction SilentlyContinue
}
