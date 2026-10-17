import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {base64,unbase64} from '../lib/web-push.ts';
const require=createRequire(import.meta.url);
const {Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const publicKey=base64(new Uint8Array(await crypto.subtle.exportKey('raw',vapid.publicKey)));
const device=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const keys={p256dh:base64(new Uint8Array(await crypto.subtle.exportKey('raw',device.publicKey))),auth:base64(crypto.getRandomValues(new Uint8Array(16)))};
const root=resolve('dist/server'),paths=readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')||p.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const pushes=[],statuses=new Map();
const mf=new Miniflare({modules:paths.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{OWNER_EMAIL:'owner@example.test',WEB_PUSH_PUBLIC_KEY:publicKey,WEB_PUSH_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',vapid.privateKey)),WEB_PUSH_SUBJECT:'https://app.test'},outboundService:async req=>{
 assert.ok(req.url.startsWith('https://fcm.googleapis.com/fcm/send/'),'Tests cannot send to real push endpoints');
 pushes.push({url:req.url,headers:req.headers,body:new Uint8Array(await req.arrayBuffer())});const status=statuses.get(req.url)||201;
 return new Response('',{status,headers:status===429?{'Retry-After':'120'}:{}});
}});
let checks=0;let db;
const endpoint=name=>'https://fcm.googleapis.com/fcm/send/'+name;
const headers=(who,church)=>({...who?{'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'}:{},...church?{'X-Church-Id':church}:{}});
async function raw(who,path,method='GET',body,church){return mf.dispatchFetch('http://app.test/api/'+path,{method,headers:{...headers(who,church),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined})}
async function call(who,path,method='GET',body,status=200,church){const res=await raw(who,path,method,body,church),data=await res.json();checks++;assert.equal(res.status,status,JSON.stringify({path,data}));return data}
async function upload(kind){const f=new FormData();f.append('file',new File([readFileSync('public/icon-192.png')],'score.png',{type:'image/png'}));const enc=new Request('http://app.test',{method:'POST',body:f});const r=await mf.dispatchFetch('http://app.test/api/files?kind='+kind,{method:'POST',headers:{...headers('owner'),'content-type':enc.headers.get('content-type')},body:await enc.arrayBuffer()});assert.equal(r.status,200);return (await r.json()).id}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(){for(let i=0;i<80;i++){const r=await db.prepare("SELECT count(*) AS n FROM push_deliveries WHERE (state='sending' OR (state='pending' AND next_at<=?))").bind(Date.now()).first();if(!r.n)return;await sleep(50)}throw new Error('Push outbox did not settle')}
async function decrypt(body){
 const salt=body.slice(0,16),pub=body.slice(21,86),cipher=body.slice(86),ua=unbase64(keys.p256dh),enc=new TextEncoder();
 const concat=(...ps)=>{const o=new Uint8Array(ps.reduce((n,p)=>n+p.length,0));let i=0;for(const p of ps){o.set(p,i);i+=p.length}return o};
 const hmac=async(k,d)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']),d));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[])},device.privateKey,256));
 const ikm=await hmac(await hmac(unbase64(keys.auth),shared),concat(enc.encode('WebPush: info\0'),ua,pub,new Uint8Array([1]))),prk=await hmac(salt,ikm);
 const cek=(await hmac(prk,concat(enc.encode('Content-Encoding: aes128gcm\0'),new Uint8Array([1])))).slice(0,16),nonce=(await hmac(prk,concat(enc.encode('Content-Encoding: nonce\0'),new Uint8Array([1])))).slice(0,12);
 const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['decrypt']),cipher));assert.equal(plain.at(-1),2);return JSON.parse(new TextDecoder().decode(plain.slice(0,-1)));
}
try{
 db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const q of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(q).run();
 await call('owner','me','POST',{name:'인도자',position:'건반'});const {code}=await call('owner','invite','POST');
 for(const who of ['drum','vocal','paused'])await call(who,'me','POST',{name:who,position:'싱어',invite:code});
 await call('owner','team','PATCH',{id:'paused',active:false});
 await db.batch([db.prepare("INSERT INTO churches (id,name,created_by,active,created) VALUES ('other','다른 교회','owner',1,1)"),db.prepare("INSERT INTO profiles (id,name,position,role,active,legacy_church,created) VALUES ('outsider','다른 교회 팀원','싱어','member',1,NULL,1)"),db.prepare("INSERT INTO memberships (church_id,user_id,role,position,active,created) VALUES ('other','outsider','member','싱어',1,1)")]);
 await call('','notifications','GET',undefined,401);await call('paused','notifications','GET',undefined,403);
 const before=await call('drum','notifications');assert.equal(before.items.length,0);assert.equal(before.publicKey,publicKey);
 for(const [who,name,church] of [['drum','drum-a'],['drum','drum-b'],['vocal','vocal-a'],['outsider','outsider','other']])await call(who,'notifications/subscribe','POST',{endpoint:endpoint(name),keys},200,church);
 await call('drum','notifications/subscribe','POST',{endpoint:'https://127.0.0.1/push',keys},400);
 await call('drum','notifications/subscribe','POST',{endpoint:endpoint('bad'),keys:{...keys,auth:'bad'}},400);
 await call('drum','notifications/subscribe','POST',{endpoint:endpoint('drum-a'),keys,userId:'vocal'},400);
 const cross=await mf.dispatchFetch('http://app.test/api/notifications/subscribe',{method:'POST',headers:{...headers('drum'),'content-type':'application/json',origin:'https://evil.test'},body:JSON.stringify({endpoint:endpoint('evil'),keys})});assert.equal(cross.status,403);
 const rawId=await upload('raw'),exp=await upload('export');
 const worship={title:'주일예배',date:'2026-10-18',passage:'시편 95',translation:'직접 입력',scripture:'시험용 본문',theme:'',rehearsal:'',notice:'',songs:[{id:'song',title:'찬양',key:'D',bpm:'72',form:[{id:'verse',type:'V1'}],pages:[{id:rawId,width:192,height:192}],exports:[exp],layout:{x:.05,y:.02,width:.9,size:.022,margin:false},notes:'',transition:'',parts:{},link:''}]};
 const draft=await call('owner','services','POST',worship),id=draft.id;
 await call('owner',`services/${id}/publish`,'POST',{revision:1,data:{...worship,passage:''}},400);
 assert.equal((await call('drum','notifications')).items.length,0,'Draft or failed publish must not notify');
 const race=await Promise.all([raw('owner',`services/${id}/publish`,'POST',{revision:1,data:worship}),raw('owner',`services/${id}/publish`,'POST',{revision:1,data:worship})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
 await settled();assert.equal(pushes.length,3,'Only two drum devices and one vocal device, never another church');
 const inbox=await call('drum','notifications'),notice=inbox.items[0];assert.equal(inbox.unread,1);assert.equal(inbox.items.length,1);assert.equal(notice.serviceId,id);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM notice_receipts').first()).n,3,'Existing active members and leader get inbox entries without rejoining');
 for(const push of pushes){const payload=await decrypt(push.body);assert.equal(payload.noticeId,notice.id);assert.equal(payload.title,'예배 콘티가 올라왔어요');assert.ok(payload.body.includes('2026-10-18'));assert.ok(push.headers.get('authorization').startsWith('vapid t='));}
 await call('outsider','notification-link/'+notice.id,'GET',undefined,404,'other');await call('outsider','notifications','GET',undefined,403,'uelin');
 assert.equal((await call('drum','notification-link/'+notice.id)).churchId,'uelin');
 await call('drum','notifications/read','POST',{id:notice.id,userId:'vocal'},400);await call('drum','notifications/read','POST',{id:notice.id});assert.equal((await call('drum','notifications')).unread,0);assert.equal((await call('vocal','notifications')).unread,1);
 await call('owner',`services/${id}`,'PUT',{revision:2,data:{...worship,notice:'미공개'}});assert.equal(pushes.length,3);
 await call('owner',`services/${id}/publish`,'POST',{revision:3,data:{...worship,notice:'수정됨'}});await settled();assert.equal(pushes.length,3,'Republish cannot announce the same week again');assert.equal((await db.prepare('SELECT count(*) AS n FROM worship_notices').first()).n,1);
 await call('owner',`services/${id}`,'DELETE',{revision:4});assert.equal((await call('vocal','notifications')).items.length,0);await call('drum','notification-link/'+notice.id,'GET',undefined,404);
 await call('owner',`services/${id}/restore`,'POST',{revision:5});assert.equal((await call('vocal','notifications')).items.length,1);await settled();assert.equal(pushes.length,3);
 await call('drum','notifications/subscribe','DELETE',{endpoint:endpoint('drum-a')});assert.equal((await call('drum','notifications/device','POST',{endpoint:endpoint('drum-a')})).enabled,false);assert.equal((await call('drum','notifications/device','POST',{endpoint:endpoint('drum-b')})).enabled,true);
 statuses.set(endpoint('vocal-a'),410);statuses.set(endpoint('drum-b'),429);
 const second=await call('owner','services','POST',{...worship,date:'2026-10-25'});await call('owner',`services/${second.id}/publish`,'POST',{revision:1,data:{...worship,date:'2026-10-25'}});await settled();assert.equal(pushes.length,5);assert.equal((await call('vocal','notifications/device','POST',{endpoint:endpoint('vocal-a')})).enabled,false,'Expired endpoint removed');
 const retry=await db.prepare("SELECT * FROM push_deliveries WHERE state='pending'").first();assert.ok(retry.next_at>=Date.now()+110000,'Honor Retry-After');assert.equal(retry.attempts,1);
 statuses.set(endpoint('drum-b'),201);await db.prepare("UPDATE push_deliveries SET next_at=0 WHERE state='pending'").run();await call('owner','notifications');await settled();assert.equal(pushes.length,6);assert.equal((await db.prepare("SELECT count(*) AS n FROM push_deliveries WHERE state='pending'").first()).n,0);
 // A browser switching accounts must stop receiving the former account's church.
 await call('outsider','notifications/subscribe','POST',{endpoint:endpoint('drum-b'),keys},200,'other');assert.equal((await call('drum','notifications/device','POST',{endpoint:endpoint('drum-b')})).enabled,false);assert.equal((await call('outsider','notifications/device','POST',{endpoint:endpoint('drum-b')},200,'other')).enabled,true);
 await call('drum','notifications/test','POST',{endpoint:endpoint('drum-b')},400);await call('outsider','notifications/test','POST',{endpoint:endpoint('drum-b')},200,'other');await call('outsider','notifications/test','POST',{endpoint:endpoint('drum-b')},429,'other');
 await call('drum','notification-device','DELETE',{endpoint:endpoint('drum-b')});assert.equal((await call('outsider','notifications/device','POST',{endpoint:endpoint('drum-b')},200,'other')).enabled,true,'Another account cannot revoke this device');
 await call('outsider','notification-device','DELETE',{endpoint:endpoint('drum-b')});assert.equal((await call('outsider','notifications/device','POST',{endpoint:endpoint('drum-b')},200,'other')).enabled,false,'Logout removes this account device and all of its church channels');
 await call('owner','team','PATCH',{id:'drum',active:false});await call('drum','notifications','GET',undefined,403);await call('drum','notification-link/'+notice.id,'GET',undefined,404);
 await db.prepare("UPDATE churches SET active=0 WHERE id='uelin'").run();await call('vocal','notification-link/'+notice.id,'GET',undefined,404);await db.prepare("UPDATE churches SET active=1 WHERE id='uelin'").run();
 // Hard deletion cascades notice data; no orphan delivery may survive.
 await call('owner',`services/${id}`,'DELETE',{revision:6});await call('owner',`services/${id}/purge`,'DELETE',{revision:7});assert.equal((await db.prepare('SELECT count(*) AS n FROM worship_notices WHERE service_id=?').bind(id).first()).n,0);assert.equal((await db.prepare('SELECT count(*) AS n FROM notice_receipts WHERE notice_id=?').bind(notice.id).first()).n,0);
 console.log(`PASS: ${checks} API checks plus assertions: publication race/deduplication, encrypted device delivery, existing members, per-device opt-out, tenant isolation, revoked accounts, read ownership, retries, expiry, account rebinding and deletion cleanup.`);
}finally{await mf.dispose()}
