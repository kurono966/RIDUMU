/* Assemble two independent static games. No runtime files are rewritten. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const extensions=new Set(['.html','.css','.js','.json','.png','.jpg','.jpeg','.gif','.svg','.webp','.avif','.ico','.wav','.mp3','.ogg','.flac','.woff','.woff2','.ttf','.wasm','.webmanifest']);
const inside=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
function copy(source,destination){
 const stat=fs.lstatSync(source);
 if(stat.isSymbolicLink())throw Error('Public files cannot be symlinks: '+source);
 if(stat.isDirectory()){fs.mkdirSync(destination,{recursive:true});for(const name of fs.readdirSync(source))copy(path.join(source,name),path.join(destination,name));}
 else if(stat.isFile())fs.copyFileSync(source,destination);
 else throw Error('Unsupported public file: '+source);
}
function files(root,base=root){return fs.readdirSync(base,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(root,path.join(base,e.name)):[path.relative(root,path.join(base,e.name))]);}
function validateSite(root,baseURL){
 const base=new URL(baseURL);
 for(const file of files(root)){
  const ext=path.extname(file),text=['.html','.css','.js'].includes(ext)?fs.readFileSync(path.join(root,file),'utf8'):'';
  const expressions=ext==='.html'?[/\b(?:src|href)\s*=\s*["']([^"']+)["']/g]:ext==='.css'?[/url\(\s*["']?([^\s"')]+)["']?\s*\)/g,/@import\s+["']([^"']+)["']/g]:ext==='.js'?[/\b(?:fetch|import)\(\s*["']([^"']+)["']/g,/\bnew\s+URL\(\s*["']([^"']+)["']/g]:[];
  for(const expression of expressions)for(const match of text.matchAll(expression)){
   const ref=match[1];if(/^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(ref))continue;
   if(ref.startsWith('/'))throw Error(file+': absolute reference breaks /dev/: '+ref);
   const target=new URL(ref,new URL(file.split(path.sep).join('/'),base));
   if(target.origin!==base.origin||!target.pathname.startsWith(base.pathname))throw Error(file+': reference escapes its branch: '+ref);
   let relative=decodeURIComponent(target.pathname.slice(base.pathname.length));if(!relative||relative.endsWith('/'))relative+='index.html';
   const resolved=path.resolve(root,relative);if(!inside(root,resolved)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())throw Error(file+': missing public file: '+ref);
  }
 }
}
function publishBranch(source,destination,baseURL){
 fs.mkdirSync(destination,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})){
  if(entry.name==='assets'||(!entry.name.startsWith('.')&&!entry.name.includes('.test.')&&extensions.has(path.extname(entry.name))))copy(path.join(source,entry.name),path.join(destination,entry.name));
 }
 if(!fs.existsSync(path.join(destination,'index.html')))throw Error('Missing index.html in '+source);
 fs.writeFileSync(path.join(destination,'.nojekyll'),'');validateSite(destination,baseURL);
}
function build({stable,development,output,shas}){
 stable=path.resolve(stable);development=path.resolve(development);output=path.resolve(output);
 if(inside(stable,output)||inside(development,output)||inside(output,stable)||inside(output,development))throw Error('Output and source folders must be separate.');
 if(fs.existsSync(output))throw Error('Output already exists; choose a new empty destination.');
 if(!shas||!['main','develop'].every(k=>/^[a-f0-9]{40}$/.test(shas[k])))throw Error('Both source commit SHAs are required.');
 publishBranch(stable,output,'https://kurono966.github.io/RIDUMU/');
 publishBranch(development,path.join(output,'dev'),'https://kurono966.github.io/RIDUMU/dev/');
 fs.writeFileSync(path.join(output,'_deployment.json'),JSON.stringify({version:1,main:{commit:shas.main,path:'/'},develop:{commit:shas.develop,path:'/dev/'}},null,2)+'\n');
}
if(require.main===module){
 const [stable,development,output]=process.argv.slice(2);
 if(!stable||!development||!output)throw Error('Usage: node scripts/build-pages.cjs <main checkout> <develop checkout> <output>');
 const sha=folder=>execFileSync('git',['-C',folder,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 build({stable,development,output,shas:{main:sha(stable),develop:sha(development)}});
 console.log('Validated stable / and development /dev/; source games were copied unchanged.');
}
module.exports={build,validateSite};
