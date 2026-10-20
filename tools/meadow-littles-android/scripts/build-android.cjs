const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const android=path.join(root,'android');
if(!fs.existsSync(path.join(android,'local.properties'))){const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||(process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'', 'Android','Sdk'):null);if(sdk&&fs.existsSync(sdk))fs.writeFileSync(path.join(android,'local.properties'),'sdk.dir='+sdk.split(path.sep).join('/')+'\n')}

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
const args=win?['-NoProfile','-Command',`& '${gradle.replace(/'/g,"''")}' assembleDebug`]:['assembleDebug'];
const result=spawnSync(command,args,{cwd:android,env,stdio:'inherit',shell:false});
if(result.error)throw result.error;
process.exitCode=result.status??1;
