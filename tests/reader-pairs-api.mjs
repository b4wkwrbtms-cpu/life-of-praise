import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const root=resolve('dist/server'),paths=readdirSync(root,{recursive:true}).filter(path=>path.endsWith('.js')||path.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:paths.map(path=>({type:'ESModule',path:resolve(root,path)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{OWNER_EMAIL:'owner@example.test'}});
let checks=0;
const headers=who=>({'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'});
async function raw(who,path,method='GET',body,church){return mf.dispatchFetch('http://app.test/api/'+path,{method,headers:{...headers(who),...(church?{'X-Church-Id':church}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
async function call(who,path,method='GET',body,status=200,church){const res=await raw(who,path,method,body,church),data=await res.json();checks++;assert.equal(res.status,status,JSON.stringify({path,data}));return data}
async function upload(kind){const form=new FormData();form.append('file',new File([readFileSync('public/icon-192.png')],'score.png',{type:'image/png'}));const encoded=new Request('http://app.test',{method:'POST',body:form});const res=await mf.dispatchFetch('http://app.test/api/files?kind='+kind,{method:'POST',headers:{...headers('owner'),'content-type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});assert.equal(res.status,200);return (await res.json()).id}
try{
 const database=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())for(const statement of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await database.prepare(statement).run();
 await call('owner','me','POST',{name:'인도자',position:'건반'});const {code}=await call('owner','invite','POST');
 await call('drum','me','POST',{name:'드럼',position:'드럼',invite:code});await call('vocal','me','POST',{name:'보컬',position:'싱어',invite:code});
 const image1=await upload('raw'),image2=await upload('raw'),image3=await upload('raw'),export1=await upload('export'),export2=await upload('export');
 const song={id:'a',title:'은혜',key:'D',bpm:'70',form:[{id:'c',type:'C'}],pages:[{id:image1,width:192,height:192},{id:image2,width:192,height:192}],exports:[export1,export2],layout:{x:.05,y:.02,width:.9,size:.022,margin:false},notes:'공통 메모',transition:'',parts:{},link:''};
 const worship={title:'주일예배',date:'2026-10-25',passage:'시편 95',translation:'직접 입력',scripture:'테스트',theme:'',rehearsal:'',notice:'',songs:[song,{...structuredClone(song),id:'b',title:'찬양'}]};
 const draft=await call('owner','services','POST',worship),id=draft.id;
 const route=version=>`services/${id}/reader-pairs?version=${version}`;
 await call('drum',route(1),'GET',undefined,404);
 await call('owner',`services/${id}/publish`,'POST',{revision:1,data:worship});
 const before=(await call('drum','services'))[0];
 const ref=(songId,pageId)=>({songId,pageId});
 const first=[ref('a',image1),ref('b',image1)],second=[ref('b',image2),ref('a',image2)];
 const initial=await call('drum',route(1));assert.deepEqual(initial.pairs,[]);assert.equal(initial.revision,0);
 await call('drum',route(0),'GET',undefined,400);await call('drum',route(99),'GET',undefined,404);
 await call('drum',route(1),'POST',{},405);
 for(const invalid of [
  {revision:0,pairs:[[first[0],first[0]]]},
  {revision:0,pairs:[first,[first[0],second[0]]]},
  {revision:0,pairs:[[ref('foreign-song',image1),first[0]]]},
  {revision:0,pairs:[[ref('a','foreign-page'),first[0]]]},
  {revision:0,pairs:[[first[0]]]},
  {revision:0,pairs:[first],userId:'vocal'},
  {revision:0,pairs:[first],churchId:'foreign-church'}
 ])await call('drum',route(1),'PUT',invalid,400);
 const notes=[{id:'memo',pageId:image1,x:.2,y:.3,text:'드럼 필인',size:.025,color:'#315d48'}];
 await call('drum',`services/${id}/personal/a?version=1`,'PUT',{revision:0,notes,exports:[]});
 const saved=await call('drum',route(1),'PUT',{revision:0,pairs:[first,second]});assert.equal(saved.revision,1);
 const anotherDevice=await call('drum',route(1));assert.deepEqual(anotherDevice.pairs,[first,second]);assert.equal(anotherDevice.revision,1);
 assert.deepEqual((await call('vocal',route(1))).pairs,[]);assert.deepEqual((await call('owner',route(1))).pairs,[]);
 await call('owner',route(1)+'&user=drum','GET',undefined,403);await call('vocal',route(1)+'&user=drum','PUT',{revision:1,pairs:[]},403);
 const race=await Promise.all([raw('drum',route(1),'PUT',{revision:1,pairs:[first]}),raw('drum',route(1),'PUT',{revision:1,pairs:[second]})]);
 assert.deepEqual(race.map(res=>res.status).sort(),[200,409],'Concurrent devices must not silently overwrite each other');
 const current=await call('drum',route(1));assert.equal(current.revision,2);
 const updated=await call('drum',route(1),'PUT',{revision:2,pairs:[first,second]});assert.equal(updated.revision,3);
 await call('vocal',route(1),'PUT',{revision:0,pairs:[[ref('a',image1),ref('a',image2)]]});assert.deepEqual((await call('drum',route(1))).pairs,[first,second]);
 assert.deepEqual((await call('drum',`services/${id}/personal/a?version=1`)).notes,notes);
 assert.deepEqual((await call('drum',`services/${id}/score-views?version=1&user=drum`)).songs.a.notes,notes);
 const after=(await call('drum','services'))[0];assert.equal(after.version,before.version);assert.equal(after.revision,before.revision);assert.deepEqual(after.data,before.data,'Personal pairing must not modify shared song order, forms, files or other content');
 await database.prepare("INSERT INTO churches(id,name,created_by,active,created) VALUES('foreign','다른 교회','owner',1,1)").run();
 await database.prepare('INSERT INTO services(id,church_id,title,date,draft,published,version,revision,updated) VALUES(?,?,?,?,?,?,1,1,1)').bind('foreign-week','foreign',worship.title,worship.date,JSON.stringify(worship),JSON.stringify(worship)).run();
 await call('drum','services/foreign-week/reader-pairs?version=1','GET',undefined,404);
 await call('drum',route(1),'GET',undefined,403,'foreign');
 await call('drum',route(1),'PUT',{revision:3,pairs:[]},403,'foreign');
 // An unchanged new publication inherits the same saved pairs without rewriting them.
 await call('owner',`services/${id}/publish`,'POST',{revision:2,data:worship});
 const inherited=await call('drum',route(2));assert.equal(inherited.revision,0);assert.equal(inherited.basedVersion,1);assert.deepEqual(inherited.pairs,[first,second]);
 // Replaced pages invalidate only their own pair; all other preferences remain.
 const replacement=structuredClone(worship);replacement.songs[0].pages[0].id=image3;
 await call('owner',`services/${id}/publish`,'POST',{revision:3,data:replacement});
 const refreshed=await call('drum',route(3));assert.deepEqual(refreshed.pairs,[second]);assert.equal(refreshed.removed,1);
 assert.deepEqual((await call('drum',route(1))).pairs,[first,second],'Historical settings stay intact');
 await call('drum',route(3),'PUT',{revision:0,pairs:[first]},400);
 await call('drum',route(3),'PUT',{revision:0,pairs:[]});assert.deepEqual((await call('drum',route(3))).pairs,[],'Explicit reset must not re-inherit old pairs');
 await call('owner','team','PATCH',{id:'drum',active:false});await call('drum',route(3),'GET',undefined,403);await call('drum',route(3),'PUT',{revision:1,pairs:[]},403);
 await call('owner',`services/${id}`,'DELETE',{revision:4});await call('vocal',route(3),'GET',undefined,404);
 await call('owner',`services/${id}/purge`,'DELETE',{revision:5});
 assert.equal((await database.prepare('SELECT count(*) AS n FROM reader_pairs WHERE service_id=?').bind(id).first()).n,0,'Permanent worship deletion cascades to pair preferences');
 console.log(`PASS: ${checks} API checks; private cross-device persistence, cross-church protection, input validation, concurrent-save conflicts, untouched common scores/notes, version inheritance, page replacement, revocation and purge cleanup.`);
}finally{await mf.dispose()}
