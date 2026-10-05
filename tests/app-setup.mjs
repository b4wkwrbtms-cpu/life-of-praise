import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const root=resolve('dist/server'),paths=readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')||p.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:paths.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{OWNER_EMAIL:'owner@example.test'}});
let checks=0;
async function request(who,path,method='GET',body,church){const res=await mf.dispatchFetch('http://app.test/api/'+path,{method,headers:{'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test',...(church?{'X-Church-Id':church}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};}
async function call(who,path,method='GET',body,status=200,church){checks++;const r=await request(who,path,method,body,church);assert.equal(r.status,status,JSON.stringify({who,path,...r}));return r.data;}
try{
 const db=await mf.getD1Database('DB');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const q of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(q).run();
 await call('owner','me','POST',{name:'총관리자',position:'인도자'});
 const code=(await call('owner','invite','POST')).code;
 for(const [id,position] of [['drummer','드럼'],['member','성도'],['pastor','교역자']]){
  await call(id,'me','POST',{name:id,position,invite:code});
  const initial=await call(id,'app-setup');assert.equal(initial.role,'team');assert.equal(initial.completed,false);
 }
 assert.equal((await call('owner','app-setup')).role,'leader');
 await call('outsider','app-setup','GET',undefined,403);
 await call('member','team','GET',undefined,403);
 await call('member','app-setup','POST',{action:'complete-guide',role:'leader',userId:'drummer'});
 assert.equal((await call('member','app-setup')).completed,true);
 assert.equal((await call('drummer','app-setup')).completed,false);
 assert.equal((await call('owner','app-setup')).completed,false);
 await call('member','app-setup','POST',{action:'installation',platform:'ios',event:'installed',userId:'drummer'});
 let row=(await call('owner','team')).find(m=>m.id==='member');assert.ok(row.devices[0].installedAt);assert.equal(row.devices[0].launchedAt,null);
 assert.equal((await call('drummer','app-setup')).devices.length,0);
 await call('member','app-setup','POST',{action:'installation',platform:'ios',event:'launched'});
 const launch=(await call('member','app-setup')).devices[0].launchedAt;assert.ok(launch);
 await call('member','app-setup','POST',{action:'installation',platform:'ios',event:'installed'});
 assert.equal((await call('member','app-setup')).devices[0].launchedAt,launch);
 await call('member','app-setup','POST',{action:'installation',platform:'android',event:'launched'});
 assert.equal((await call('member','app-setup')).devices.length,2);
 await call('member','app-setup','POST',{action:'installation',platform:'fake',event:'launched'},400);
 const inv=(await call('owner','platform/invites','POST',{label:'다른 교회'})).code;
 const a=await call('leader','church-applications','POST',{name:'다른 인도자',churchName:'다른 교회',leaderCode:inv});
 const church=(await call('owner','platform/applications/'+a.id+'/approve','POST',{})).churchId;
 assert.equal((await call('leader','team','GET',undefined,200,church)).some(m=>m.id==='member'),false);
 await call('member','app-setup','GET',undefined,403,church);
 await call('member','app-setup','POST',{action:'installation',platform:'ios',event:'launched'},403,church);
 // Changing role requires its own tutorial completion, determined by authenticated membership.
 await db.prepare("UPDATE memberships SET role='admin' WHERE user_id='member'").run();
 assert.equal((await call('member','app-setup')).role,'leader');assert.equal((await call('member','app-setup')).completed,false);
 await db.prepare("UPDATE memberships SET role='member',active=0 WHERE user_id='member'").run();
 await call('member','app-setup','POST',{action:'complete-guide'},403);
 console.log('App onboarding/install: '+checks+' API checks passed, role isolation, multi-platform reports and church access verified.');
}finally{await mf.dispose()}
