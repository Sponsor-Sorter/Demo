const fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto'),vm=require('vm');
const manifest=JSON.parse(fs.readFileSync('meadow-and-market/native-release.json','utf8')),apk=fs.readFileSync('meadow-and-market/'+manifest.apk);
assert.equal(manifest.packageId,'com.meadowandmarket.game');assert.equal(manifest.versionCode,9);assert.equal(manifest.versionName,'1.6.1');assert.equal(apk.length,manifest.bytes);assert.equal(crypto.createHash('sha256').update(apk).digest('hex'),manifest.sha256);assert(apk.length<8*1024*1024,'Native shell stays small; HD assets are delivered by the live game');
const root='tools/meadow-android/',java=fs.readFileSync(root+'android/app/src/main/java/com/meadowandmarket/game/MeadowUpdatesPlugin.java','utf8'),rules=fs.readFileSync(root+'android/app/src/main/java/com/meadowandmarket/game/MeadowUpdateRules.java','utf8');
for(const required of ['setInstanceFollowRedirects(false)','validDownload(','sameIdentity(','canRequestPackageInstalls()','FileProvider.getUriForFile','Intent.ACTION_VIEW','getFD().sync()'])assert(java.includes(required),required);
assert(rules.includes('expectedCode > currentCode'));assert(rules.includes('Arrays.equals(currentCerts,downloadedCerts)'));
const scope={window:{}};vm.runInNewContext(fs.readFileSync('meadow-and-market/native-updates.js','utf8'),scope);assert.equal(scope.window.meadowNativeUpdates.available,false);scope.window.meadowNativeUpdates.attach({});
assert(fs.readFileSync('meadow-and-market/game.js','utf8').includes('meadowNativeUpdates?.attach'));
console.log('Native release: exact APK SHA256/bytes, package/version metadata, small live-game shell, platform signature/version gates, redirect denial, installer confirmation and browser exclusion passed.');
