const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {build}=require('./scripts/build-pages.cjs');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ridumu-pages-'));
 t.after(()=>{const resolved=path.resolve(directory);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'ridumu-pages-'))throw Error('Unsafe temporary path');fs.rmSync(resolved,{recursive:true,force:true});});
 const stable=path.join(directory,'stable'),development=path.join(directory,'development');
 for(const [dir,version] of [[stable,'stable'],[development,'development']]){
  fs.mkdirSync(path.join(dir,'assets'),{recursive:true});fs.mkdirSync(path.join(dir,'.git'));fs.mkdirSync(path.join(dir,'scripts'));
  fs.writeFileSync(path.join(dir,'index.html'),'<link rel="stylesheet" href="style.css?v=1"><script src="game.js"></script><audio src="assets/kick%20sound.wav"></audio>');
  fs.writeFileSync(path.join(dir,'style.css'),'body{background:url("assets/bg.svg")}');fs.writeFileSync(path.join(dir,'game.js'),version);
  fs.writeFileSync(path.join(dir,'assets','bg.svg'),'<svg/>');fs.writeFileSync(path.join(dir,'assets','kick sound.wav'),version+' audio');
  fs.writeFileSync(path.join(dir,'game.test.cjs'),'test');fs.writeFileSync(path.join(dir,'README.md'),'private notes');fs.writeFileSync(path.join(dir,'scripts','internal.js'),'build tooling');
 }
 const shas={main:'a'.repeat(40),develop:'b'.repeat(40)};
 return {stable,development,shas,output:path.join(directory,'site'),directory};
}
test('both sites preserve bytes and resolve relative assets without exposing source tooling',t=>{
 const f=fixture(t);build(f);
 for(const [source,prefix] of [[f.stable,f.output],[f.development,path.join(f.output,'dev')]])for(const name of ['index.html','game.js','style.css','assets/kick sound.wav'])assert.deepEqual(fs.readFileSync(path.join(source,name)),fs.readFileSync(path.join(prefix,name)));
 for(const name of ['.git','scripts','README.md','game.test.cjs'])assert(!fs.existsSync(path.join(f.output,name)));
 assert(fs.existsSync(path.join(f.output,'.nojekyll')));assert(fs.existsSync(path.join(f.output,'dev','.nojekyll')));
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.output,'_deployment.json'))).main.commit,f.shas.main);
});
test('updating develop cannot change stable files; promoting develop updates stable',t=>{
 const f=fixture(t);build(f);const previous=fs.readFileSync(path.join(f.output,'game.js'));
 fs.writeFileSync(path.join(f.development,'game.js'),'development v2');const output2=path.join(f.directory,'second');build({...f,output:output2,shas:{...f.shas,develop:'c'.repeat(40)}});
 assert.deepEqual(fs.readFileSync(path.join(output2,'game.js')),previous);assert.equal(fs.readFileSync(path.join(output2,'dev','game.js'),'utf8'),'development v2');
 fs.copyFileSync(path.join(f.development,'game.js'),path.join(f.stable,'game.js'));const output3=path.join(f.directory,'promoted');build({...f,output:output3});assert.equal(fs.readFileSync(path.join(output3,'game.js'),'utf8'),'development v2');
});
test('missing, absolute and cross-branch references fail before deployment',t=>{
 const f=fixture(t);
 for(const [i,reference] of ['missing.js','/RIDUMU/game.js','../game.js'].entries()){
  fs.writeFileSync(path.join(f.development,'index.html'),'<script src="'+reference+'"></script>');
  assert.throws(()=>build({...f,output:path.join(f.directory,'bad'+i)}),/missing|absolute|escapes/);
 }
});
test('packaging refuses to overwrite directories or write inside a checkout',t=>{
 const f=fixture(t);assert.throws(()=>build({...f,output:path.join(f.stable,'site')}),/separate/);build(f);assert.throws(()=>build(f),/already exists/);
});
