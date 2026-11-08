const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const powershell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const windows={skip:process.platform!=='win32',timeout:60000};
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const exists=async p=>!!await fs.stat(p).catch(()=>null);
async function until(fn){const end=Date.now()+20000;while(!await fn()){if(Date.now()>end)throw Error('Build fixture timed out');await new Promise(r=>setTimeout(r,100));}}
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'camera-build-中文 '));
 await fs.mkdir(path.join(root,'scripts'));await fs.mkdir(path.join(root,'bin'));await fs.mkdir(path.join(root,'runtime'));
 for(const name of ['build-editor.ps1','build-support.ps1','build-cleanup.ps1'])await fs.copyFile(path.join(__dirname,'../scripts',name),path.join(root,'scripts',name));
 await fs.writeFile(path.join(root,'package.json'),JSON.stringify({version:'0.6.0'}));await fs.writeFile(path.join(root,'package-lock.json'),'{}');
 for(const name of ['lua54.exe','lua54.dll'])await fs.writeFile(path.join(root,'runtime',name),'fixture');
 await fs.writeFile(path.join(root,'bin/npm.cmd'),'@echo off\r\n"'+process.execPath+'" "%~dp0runner.cjs" %*\r\nexit /b %errorlevel%\r\n');
 await fs.writeFile(path.join(root,'bin/runner.cjs'),`
const fs=require('node:fs'),path=require('node:path');const args=process.argv.slice(2),stage=args[0]==='ci'?'ci':args[1];
fs.appendFileSync('calls.txt',stage+'\\n');fs.writeFileSync(path.join(process.env.TEMP,'tool.tmp'),'temporary');
if(stage===process.env.FIXTURE_FAIL){console.error(process.env.FIXTURE_ERROR||'HTTPError: Response code 504 (Gateway Time-out)');process.exit(7);}
function put(p,v='fixture'){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
if(stage==='ci')for(const p of ['node_modules/.bin/vite.cmd','node_modules/.bin/tsc.cmd','node_modules/.bin/electron-builder.cmd','node_modules/electron/install.js'])put(p);
if(stage==='electron:install')put('node_modules/electron/dist/electron.exe');
if(stage==='build')put('dist/index.html');
if(stage==='package:installer'){put('release/CameraFrameworkEditor-0.6.0-Setup.exe');put('release/win-unpacked/相机框架编辑器.exe');}
console.log('tool complete: '+stage);
`);
 return root;
}
function start(root,env={},pause=false){
 const child=spawn(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/build-editor.ps1'),...(pause?[]:['-NoPause'])],{cwd:root,windowsHide:true,env:{...process.env,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,...env},stdio:['pipe','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b.toString('utf8'));child.stderr.on('data',b=>output+=b.toString('utf8'));
 const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code));});
 return {child,done,output:()=>output,session:()=>output.match(/本次临时目录：([^\r\n]+)/)?.[1]};
}
test('build helper completes all stages, preserves outputs/dependencies and cleans only session temp',windows,async()=>{
 const root=await fixture(),keep=path.join(root,'keep-cache');await fs.writeFile(keep,'keep');const p=start(root);
 assert.equal(await p.done,0,p.output());assert.match(p.output(),/构建成功/);assert.ok(p.session());assert.equal(await exists(p.session()),false);
 for(const f of ['release/CameraFrameworkEditor-0.6.0-Setup.exe','release/win-unpacked/相机框架编辑器.exe','dist/index.html','node_modules/electron/dist/electron.exe','logs/build-editor.log'])assert.ok(await exists(path.join(root,f)),f);
 assert.equal(await fs.readFile(keep,'utf8'),'keep');assert.equal(await fs.readFile(path.join(root,'calls.txt'),'utf8'),'ci\nelectron:install\nbuild\npackage:installer\n');
});
test('download failure explains 504 in Chinese, records diagnostics and never reaches compilation',windows,async()=>{
 const root=await fixture();await fs.mkdir(path.join(root,'release'));const old=path.join(root,'release/previous.exe');await fs.writeFile(old,'previous');const p=start(root,{FIXTURE_FAIL:'electron:install'});
 assert.equal(await p.done,1,p.output());assert.match(p.output(),/构建失败：准备 Electron/);assert.match(p.output(),/下载服务或网络链路/);assert.match(p.output(),/ELECTRON_MIRROR/);assert.doesNotMatch(p.output(),/构建成功/);
 assert.equal(await exists(p.session()),false);assert.equal(await fs.readFile(old,'utf8'),'previous');assert.equal(await fs.readFile(path.join(root,'calls.txt'),'utf8'),'ci\nelectron:install\n');assert.match(await fs.readFile(path.join(root,'logs/build-editor.log'),'utf8'),/504/);
});
test('compile and packaging failures report the actual stage and actionable Chinese guidance',windows,async()=>{
 for(const [stage,error,expected] of [['build','src/App.tsx(1,1): error TS1234',/源码编译未通过/],['package:installer','EBUSY: file is being used',/文件被占用或无写入权限/]]){
  const root=await fixture(),p=start(root,{FIXTURE_FAIL:stage,FIXTURE_ERROR:error});assert.equal(await p.done,1,p.output());assert.match(p.output(),expected);assert.doesNotMatch(p.output(),/构建成功/);assert.equal(await exists(p.session()),false);
 }
});
test('Enter exit removes session junction without traversing its external target',windows,async()=>{
 const root=await fixture(),p=start(root,{},true);
 try{await until(()=>p.output().includes('按 Enter'));assert.ok(await exists(p.session()));const external=path.join(root,'external');await fs.mkdir(external);await fs.writeFile(path.join(external,'keep.txt'),'safe');await fs.symlink(external,path.join(p.session(),'files/linked'),'junction');p.child.stdin.write('\r\n');assert.equal(await p.done,0,p.output());assert.equal(await exists(p.session()),false);assert.equal(await fs.readFile(path.join(external,'keep.txt'),'utf8'),'safe');}
 finally{if(p.child.exitCode===null)p.child.kill();}
});
test('detached watcher removes failed-build temp after the build process is abruptly closed',windows,async()=>{
 const root=await fixture(),p=start(root,{FIXTURE_FAIL:'electron:install'},true);
 try{await until(()=>p.output().includes('按 Enter'));const session=p.session();assert.ok(await exists(session));await new Promise(r=>setTimeout(r,1000));p.child.kill();await p.done;await until(async()=>!await exists(session));assert.ok(await exists(path.join(root,'node_modules')));assert.ok(await exists(path.join(root,'logs/build-editor.log')));}
 finally{if(p.child.exitCode===null)p.child.kill();}
});
test('concurrent build is rejected without touching the active build session',windows,async()=>{
 const root=await fixture(),first=start(root,{},true);
 try{await until(()=>first.output().includes('按 Enter'));const second=start(root);assert.equal(await second.done,1,second.output());assert.match(second.output(),/已有构建正在运行/);assert.ok(await exists(first.session()));first.child.stdin.write('\r\n');assert.equal(await first.done,0);}
 finally{if(first.child.exitCode===null)first.child.kill();}
});
test('cleanup refuses unrelated paths and missing input files fail before dependency installation',windows,async()=>{
 const root=await fixture();const support=path.join(root,'scripts/build-support.ps1');const command=`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); . ${quote(support)}; try { Remove-BuildSession ${quote(root)} ${quote(os.tmpdir())} 'wrong'; exit 4 } catch { Write-Output $_.Exception.Message; exit 0 }`;
 const result=await exec(powershell,['-NoProfile','-ExecutionPolicy','Bypass','-Command',command],{windowsHide:true});assert.match(result.stdout,/拒绝清理/);assert.ok(await exists(path.join(root,'package.json')));
 await fs.unlink(path.join(root,'runtime/lua54.dll'));const p=start(root);assert.equal(await p.done,1);assert.match(p.output(),/缺少必要文件/);assert.equal(await exists(path.join(root,'calls.txt')),false);assert.equal(await exists(p.session()),false);
});
