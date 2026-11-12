const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const task=process.argv[2]||'assembleAcceptanceDebug';
if(!['assembleAcceptanceDebug','assemblePlayDebug','bundleAcceptanceRelease','bundlePlayRelease','testAcceptanceDebugUnitTest','lintAcceptanceRelease','lintPlayRelease'].includes(task))throw new Error('Unknown Littles build task');
if(task==='bundlePlayRelease'&&(!/^ca-app-pub-\d+~\d+$/.test(process.env.LITTLES_ADMOB_APP_ID||'')||!/^ca-app-pub-\d+\/\d+$/.test(process.env.LITTLES_BANNER_AD_UNIT||'')||(process.env.LITTLES_ADMOB_APP_ID||'').includes('3940256099942544')))throw new Error('Production needs Littles-specific live AdMob identifiers');
if(task.startsWith('bundle')&&task.includes('Release')&&!process.env.LITTLES_UPLOAD_KEYSTORE)throw new Error('A protected Littles upload key is required');
const android=path.join(root,'android');
if(!fs.existsSync(path.join(android,'local.properties'))){const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||(process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'', 'Android','Sdk'):null);if(sdk&&fs.existsSync(sdk))fs.writeFileSync(path.join(android,'local.properties'),'sdk.dir='+sdk.split(path.sep).join('/').replace(/:/g,'\\:')+'\n')}

const sourceConfig=JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json'),'utf8'));
const packagedConfig=JSON.parse(fs.readFileSync(path.join(android,'app','src','main','assets','capacitor.config.json'),'utf8'));
if(!sourceConfig.server?.url||packagedConfig.server?.url!==sourceConfig.server.url){
  throw new Error('Android live-game URL is missing or out of date. Run npm run android:sync before building.');
}
const win=process.platform==='win32';
const gradle=path.join(android,win?'gradlew.bat':'gradlew');
const env={...process.env};
if(win){
  const bundledJdk='C:\\Program Files\\Android\\Android Studio\\jbr';
  if(fs.existsSync(path.join(bundledJdk,'bin','javac.exe'))){env.JAVA_HOME=bundledJdk;env.PATH=path.join(bundledJdk,'bin')+';'+env.PATH;}
}
const command=win?path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'):gradle;
// Recreate release intermediates after source moves; never ship an incremental omission.
const tasks=task.startsWith('bundle')?[':app:clean',task]:[task];
const args=win?['-NoProfile','-Command',`& '${gradle.replace(/'/g,"''")}' ${tasks.join(' ')}`]:tasks;
const result=spawnSync(command,args,{cwd:android,env,stdio:'inherit',shell:false});
if(result.error)throw result.error;
process.exitCode=result.status??1;
if(result.status===0&&(task.startsWith('bundle')||task.startsWith('assemble'))){
  const variant=task.replace(/^(bundle|assemble)/,'');
  const flavor=variant.replace(/(Debug|Release)$/,'').toLowerCase();
  const type=variant.endsWith('Debug')?'debug':'release';
  const artifact=task.startsWith('bundle')
    ?path.join(android,'app/build/outputs/bundle',flavor+'Release',`app-${flavor}-release.aab`)
    :path.join(android,'app/build/outputs/apk',flavor,type,`app-${flavor}-${type}.apk`);
  const check=spawnSync(process.execPath,[path.join(__dirname,'check-package.cjs'),artifact],{stdio:'inherit',shell:false});
  if(check.error)throw check.error;
  process.exitCode=check.status??1;
}
