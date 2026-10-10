import assert from 'node:assert/strict';
import {readEntry,entryReturnPath,signInPath,signOutPath,safeRelativeReturnPath} from '../lib/entry.ts';
import {readApiResponse} from '../lib/api-response.ts';
const entry=query=>readEntry(new URLSearchParams(query));
assert.deepEqual(entry(''),{role:'team',code:'',issue:''});
assert.equal(entry('join=leader').role,'leader');
assert.equal(entry('join=admin').role,'team');
assert.deepEqual(entry('invite=team-code&join=leader'),{role:'team',code:'team-code',issue:''});
assert.deepEqual(entry('leader=leader-code'),{role:'leader',code:'leader-code',issue:''});
for(const query of ['invite=','leader=','invite=%20%20','invite=a&leader=b','invite=a&invite=b','leader=a&leader=b','invite='+('a'.repeat(101))]){
 assert.ok(entry(query).issue,'Invalid or ambiguous invitations must be explained');
 assert.equal(entry(query).code,'','Never silently pick or truncate an invitation');
}
for(const role of ['team','leader'])for(const code of ['abc-123','A+B/C=','a&leader=other']){
 const original={role,code},path=entryReturnPath(original),callback=new URL(signInPath(path),'https://app.test').searchParams.get('return_to');
 assert.equal(callback,path);
 assert.deepEqual(readEntry(new URL(callback,'https://app.test').searchParams),{...original,issue:''});
 assert.equal(new URL(signOutPath(path),'https://app.test').searchParams.get('return_to'),path);
}
assert.equal(entryReturnPath({role:'team',code:''}),'/');
assert.equal(entryReturnPath({role:'leader',code:''}),'/?join=leader');
for(const unsafe of ['https://evil.test','//evil.test','/\\evil.test','/signin-with-chatgpt','/signout-with-chatgpt?return_to=/','/callback?code=secret','javascript:alert(1)'])assert.equal(safeRelativeReturnPath(unsafe),'/');
assert.equal(safeRelativeReturnPath('/?invite=a%26b#join'),'/?invite=a%26b#join');
assert.deepEqual(await readApiResponse(Response.json({ok:true})),{ok:true});
assert.deepEqual(await readApiResponse(Response.json([])),[]);
await assert.rejects(()=>readApiResponse(Response.json({error:'expired'},{status:401})),e=>e.status===401&&e.message.includes('같은 계정'));
await assert.rejects(()=>readApiResponse(Response.json({error:'교회 접근 중지'},{status:403})),e=>e.status===403&&e.message==='교회 접근 중지');
await assert.rejects(()=>readApiResponse(new Response('<html>private upstream details</html>',{status:502})),e=>e.status===502&&!e.message.includes('private'));
await assert.rejects(()=>readApiResponse(new Response('<html>sign in</html>',{status:401})),e=>e.status===401);
await assert.rejects(()=>readApiResponse(new Response('<html>unexpected response</html>')),e=>e.status===502);
console.log('PASS: role hints, unambiguous invitations, return/sign-out round trips, redirect boundaries, 401/403 and non-JSON errors.');

// Exercise the real compiled app with no production data or credentials.
const {createRequire}=await import('node:module'),{dirname,resolve}=await import('node:path'),{readdirSync}=await import('node:fs');
const require=createRequire(import.meta.url),{Miniflare}=await import(require.resolve('miniflare',{paths:[dirname(require.resolve('wrangler/package.json'))]}));
const root=resolve('dist/server'),paths=readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')||p.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:paths.map(p=>({type:'ESModule',path:resolve(root,p)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET']});
try{
 for(const [path,text,callback] of [
  ['/','함께 준비하는 예배','/'],
  ['/?invite=test-team','찬양팀 초대 링크','/?invite=test-team'],
  ['/?leader=test-leader','인도자 초대 링크','/?leader=test-leader'],
  ['/?join=leader','총관리자의 교회·인도자 승인','/?join=leader']
 ]){
  const res=await mf.dispatchFetch('http://app.test'+path);assert.equal(res.status,200);
  const html=await res.text();assert.ok(html.includes(text));
  assert.ok(html.includes('href="'+signInPath(callback)+'" target="_top"'));
  assert.ok(!html.includes('Google로 로그인'));assert.ok(!html.includes('Apple로 로그인'));
 }
 for(const path of ['/?invite=a&leader=b','/?invite=']){
  const html=await(await mf.dispatchFetch('http://app.test'+path)).text();
  assert.ok(html.includes('role="alert"'));assert.ok(!html.includes('class="primary entry-login"'));
 }
 for(const path of ['/api/me','/api/services','/api/platform/churches']){
  const res=await mf.dispatchFetch('http://app.test'+path);assert.equal(res.status,401);
 }
 console.log('PASS: 6 rendered entry states, native top-level sign-in links, unavailable providers hidden, 3 anonymous API gates.');
}finally{await mf.dispose()}
