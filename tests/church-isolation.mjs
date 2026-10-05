import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const root=resolve('dist/server'),paths=readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')||p.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:paths.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{OWNER_EMAIL:'owner@example.test'}});
const song={id:'song',title:'같은 제목의 찬양',key:'D',bpm:'72',form:[{id:'form',type:'Cx2'}],pages:[],exports:[],layout:{x:.05,y:.02,width:.9,size:.022,margin:false},notes:'',transition:'',parts:{},link:''};
const worship={title:'교회 예배',date:'2026-10-11',passage:'검토용 본문',translation:'직접 입력',scripture:'검토용 말씀입니다.',theme:'',rehearsal:'',notice:'',songs:[song]};
let requests=0;
function headers(who,church){return {'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test',...(church?{'X-Church-Id':church}:{})}}
async function call(who,path,method='GET',body,expected=200,church){requests++;const res=await mf.dispatchFetch('http://app.test/api/'+path,{method,headers:{...headers(who,church),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json();assert.equal(res.status,expected,JSON.stringify({who,church,path,status:res.status,data}));return data;}
async function upload(who,church,kind='raw'){const form=new FormData();form.append('file',new File([readFileSync('public/icon-192.png')],'score.png',{type:'image/png'}));const encoded=new Request('http://app.test',{method:'POST',body:form});const res=await mf.dispatchFetch('http://app.test/api/files?kind='+kind,{method:'POST',headers:{...headers(who,church),'content-type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});assert.equal(res.status,200);return (await res.json()).id;}
async function image(who,id,church,expected=200,extra={}){const res=await mf.dispatchFetch('http://app.test/api/files/'+id,{headers:{...headers(who,church),...extra}});assert.equal(res.status,expected);return res;}
try{
 const db=await mf.getD1Database('DB');
 const createChurch=async(who,name)=>{const {code}=await call('owner','platform/invites','POST',{label:name});const a=await call(who,'church-applications','POST',{name:who+' 인도자',churchName:name,leaderCode:code});return (await call('owner','platform/applications/'+a.id+'/approve','POST',{})).churchId;};
 const migrate=async file=>{for(const q of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(q).run();};
 const migrations=readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations.filter(f=>f<'0002'))await migrate(file);
 // Start with the actual old schema and populated records, then migrate it.
 await db.prepare("INSERT INTO profiles (id,name,position,role,active,created) VALUES ('owner','기존 인도자','건반','admin',1,1),('legacy','기존 팀원','드럼','member',1,2)").run();
 await db.prepare("INSERT INTO settings (id,value) VALUES ('invite',?)").bind(createHash('sha256').update('old-invite').digest('hex')).run();
 await db.prepare("INSERT INTO services (id,title,date,draft,published,version,revision,updated) VALUES ('old-week','기존 예배','2026-10-04',?,?,1,2,1)").bind(JSON.stringify(worship),JSON.stringify(worship)).run();
 await db.prepare("INSERT INTO files (id,owner,name,type,kind,shared,size,created) VALUES ('old-file','owner','old.png','image/png','raw',1,1,1)").run();
 await db.prepare("INSERT INTO fixed_songs (id,title,data,updated) VALUES ('old-fixed','기존 고정찬양',?,1)").bind(JSON.stringify(song)).run();
 for(const file of migrations.filter(f=>f>='0002'))await migrate(file);
 const before=await call('legacy','me');assert.equal(before.church.name,'유엘인교회 찬양팀');assert.equal(before.profile.role,'member');assert.equal(before.profile.position,'드럼');assert.equal(before.superAdmin,false);
 assert.equal((await call('owner','me')).profile.superAdmin,true);assert.equal((await call('owner','services'))[0].id,'old-week');assert.equal((await call('owner','fixed-songs'))[0].id,'old-fixed');assert.equal((await db.prepare("SELECT church_id FROM files WHERE id='old-file'").first()).church_id,'uelin');
 await call('oldjoin','me','POST',{name:'이전 초대 가입',position:'싱어',invite:'old-invite'});
 assert.equal((await call('oldjoin','me')).church.id,'uelin');
 assert.equal((await call('newcomer','me')).profile,null);await call('newcomer','me','POST',{name:'무단 가입',position:'인도자'},403);await call('newcomer','services','GET',undefined,403);
 await call('a','churches','POST',{name:'가 인도자',churchName:'가교회 찬양팀',position:'싱어'},403);
 const A=await createChurch('a','가교회 찬양팀');
 const B=await createChurch('b','나교회 찬양팀');
 assert.equal((await call('a','me','GET',undefined,200,A)).profile.role,'admin');assert.equal((await call('a','me','GET',undefined,200,A)).superAdmin,false);
 assert.deepEqual((await call('a','churches')).map(c=>c.id),[A]);assert.equal((await call('owner','churches')).length,3);
 assert.equal((await call('a','services','GET',undefined,200,A)).length,0);assert.equal((await call('a','fixed-songs','GET',undefined,200,A)).length,0);
 await call('a','churches/select','POST',{id:B},403);await call('a','services','GET',undefined,403,B);await call('a','services','GET',undefined,403,'uelin');
 await call('a','churches/'+B,'PATCH',{name:'탈취 시도'},403,A);await call('a','churches/'+A,'PATCH',{active:false},403,A);
 const ia=(await call('a','invite','POST',undefined,200,A)).code,ib=(await call('b','invite','POST',undefined,200,B)).code;
 await call('candidate','me','POST',{name:'승인 대기',position:'인도자',invite:ia},403);await call('candidate','me','POST',{name:'신규 팀원',position:'싱어',invite:ia});await call('candidate','me','POST',{name:'승인 대기',position:'드럼',invite:ib});
 let m=await call('candidate','me','GET',undefined,200,A);assert.equal(m.profile.role,'member');assert.equal(m.profile.leaderRequested,0);assert.equal((await call('candidate','me','GET',undefined,200,B)).profile.position,'드럼');
 await call('candidate','services','POST',worship,403,A);await call('candidate','team','GET',undefined,403,A);
 await call('b','team','PATCH',{id:'candidate',role:'admin'},403,B);await call('a','team','PATCH',{id:'b',role:'admin'},404,A);
 await call('a','team','PATCH',{id:'candidate',role:'admin'},403,A);
 assert.equal((await call('candidate','me','GET',undefined,200,A )).profile.role,'member');assert.equal((await call('candidate','me','GET',undefined,200,B)).profile.role,'member');
 await call('candidate','services','POST',worship,403,B);
 const raw=await upload('a',A),exp=await upload('a',A,'export'),score=structuredClone(worship);score.songs[0].pages=[{id:raw,width:192,height:192}];score.songs[0].exports=[exp];
 const bscore=structuredClone(worship);bscore.songs[0].pages=[{id:await upload('b',B),width:192,height:192}];bscore.songs[0].exports=[await upload('b',B,'export')];
 const sa=await call('a','services','POST',score,200,A),sb=await call('b','services','POST',bscore,200,B);
 await call('a',`services/${sa.id}/publish`,'POST',{revision:1,data:score},200,A);await call('b',`services/${sb.id}/publish`,'POST',{revision:1,data:bscore},200,B);
 const fixed=await call('a','fixed-songs','POST',{song:score.songs[0],autoAdd:false},200,A);
 const ca=await call('a','comments','POST',{serviceId:sa.id,songId:'song',text:'가교회 전용 대화'},200,A);
 for(const path of [`services/${sa.id}/versions`,`services/${sa.id}/personal/song?version=1`,`comments?service=${sa.id}`])await call('b',path,'GET',undefined,404,B);
 await call('b','comments/'+ca.id,'PATCH',{text:'다른 교회 수정'},404,B);await call('b','comments/'+ca.id,'DELETE',undefined,404,B);
 await call('b',`services/${sa.id}`,'PUT',{revision:2,data:worship},404,B);await call('b',`services/${sa.id}`,'DELETE',{revision:2},404,B);await call('b',`services/${sa.id}/confirm`,'POST',{version:1},404,B);
 await call('b','fixed-songs/'+fixed.id,'PUT',{revision:1,song:bscore.songs[0],autoAdd:false},409,B);await call('b','fixed-songs/'+fixed.id,'PATCH',{revision:1,autoAdd:true},409,B);await call('b','fixed-songs/'+fixed.id,'DELETE',{revision:1},409,B);
 assert.equal((await call('a','services','GET',undefined,200,A)).length,1);assert.equal((await call('b','services','GET',undefined,200,B))[0].id,sb.id);
 await image('candidate',raw,A);await image('candidate',raw,B,404);await image('b',raw,B,404);await image('b',raw,A,403);
 const queryImage=await mf.dispatchFetch('http://app.test/api/files/'+raw+'?church='+A,{headers:{...headers('candidate'),cookie:'praise_church='+B}});assert.equal(queryImage.status,200,'An image keeps its own church context across tabs');
 await call('b','services','POST',score,400,B);await call('b',`services/${sb.id}`,'PUT',{revision:2,data:score},400,B);await call('b',`services/${sb.id}/publish`,'POST',{revision:2,data:score},400,B);await call('b','fixed-songs','POST',{song:score.songs[0],autoAdd:false},400,B);
 // The same user in both churches still cannot attach one church's private files in another.
 const comment=await upload('candidate',A,'comment'),personal=await upload('candidate',A,'personal');
 await call('candidate','comments','POST',{serviceId:sb.id,text:'잘못된 첨부',attachment:comment},400,B);
 await call('candidate',`services/${sb.id}/personal/song?version=1`,'PUT',{revision:0,notes:[],exports:[personal]},400,B);
 await call('a',`services/${sa.id}`,'DELETE',{revision:2},200,A);await call('b',`services/${sa.id}/restore`,'POST',{revision:3},409,B);await call('b',`services/${sa.id}/purge`,'DELETE',{revision:3},404,B);
 assert.equal((await call('a','services?trash=1','GET',undefined,200,A))[0].id,sa.id);await call('a',`services/${sa.id}/restore`,'POST',{revision:3},200,A);
 // Removing access in A leaves the same user's B membership intact.
 await call('a','team','PATCH',{id:'candidate',active:false},200,A);await call('candidate','services','GET',undefined,403,A);assert.equal((await call('candidate','services','GET',undefined,200,B)).length,1);
 await call('candidate','me','POST',{name:'재가입 시도',position:'인도자',invite:ia},403);await call('a','team','PATCH',{id:'candidate',active:true},200,A);
 await call('a','team','PATCH',{id:'a',role:'member'},403,A);await call('owner','team','PATCH',{id:'b',active:false},400,B);
 await call('owner','churches/'+B,'PATCH',{active:false});await call('b','services','GET',undefined,403,B);await call('b','churches/select','POST',{id:B},403);assert.equal((await call('owner','services','GET',undefined,200,B)).length,1);
 await call('owner','churches/'+B,'PATCH',{active:true});await call('owner','churches/uelin','PATCH',{active:false},400);
 await call('owner','churches/'+B,'PATCH',{name:'나교회 찬양팀 변경'});assert.equal((await call('b','me','GET',undefined,200,B)).church.name,'나교회 찬양팀 변경');
 const rotated=(await call('a','invite','POST',undefined,200,A)).code;await call('late','me','POST',{name:'이전 링크',position:'성도',invite:ia},403);await call('late','me','POST',{name:'새 링크',position:'성도',invite:rotated});
 assert.equal((await db.prepare("SELECT count(*) AS n FROM memberships WHERE church_id='uelin' AND user_id IN ('a','b','candidate','late')").first()).n,0,'New accounts never inherit legacy access');
 console.log(`PASS: ${requests} church API checks; old-schema migration, scoped leaders and approvals, multi-church roles, ID/file tampering, private attachments, trash, suspension, invitations and total-admin access.`);
}finally{await mf.dispose()}
