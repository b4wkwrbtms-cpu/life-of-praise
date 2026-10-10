import assert from 'node:assert/strict';
import {requestJson} from '../lib/api-response.ts';
import {teamGroups} from '../lib/team-members.ts';
import {api,setChurchContext} from '../lib/client.ts';

const members=[
 {id:'leader',name:'인도자',position:'인도자',role:'admin',active:1,devices:[{platform:'ios',launchedAt:1}]},
 {id:'member',name:'다른 팀원',position:'싱어',role:'member',active:1,devices:[]},
 {id:'removed',name:'소속 해제 팀원',position:'싱어',role:'member',active:0,devices:[{platform:'ios',launchedAt:1}]}
];
const group=teamGroups(members);
assert.equal(group.activeCount,2);assert.equal(group.inactiveCount,1);assert.equal(group.launchedCount,1);
assert.deepEqual(group.active.map(m=>m.id),['leader','member']);
assert.deepEqual(teamGroups(members,'다른 싱어').active.map(m=>m.id),['member']);
assert.deepEqual(teamGroups(members,'해제').inactive.map(m=>m.id),['removed']);
assert.equal(teamGroups(members,'없는 이름').active.length,0);

const originalFetch=globalThis.fetch;
try{
 let calls=0;
 globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch')};
 await assert.rejects(()=>requestJson('/api/me'),e=>e.status===0&&e.message.includes('네트워크'));
 assert.equal(calls,1,'No implicit network retry');
 globalThis.fetch=async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}))};
 await assert.rejects(()=>requestJson('/api/me',{},5),e=>e.status===408&&e.message.includes('연결 시간'));
 await assert.rejects(()=>requestJson('/api/services',{method:'POST'},5),e=>e.status===408&&e.message.includes('저장되었을 수'));
 assert.equal(calls,3,'A timed-out write must not be replayed');

 const pending=[];
 globalThis.fetch=async(url,init)=>{calls++;return new Promise(resolve=>pending.push({url,init,resolve}))};
 setChurchContext('church-a');
 const a=api('services'),b=api('services');
 assert.equal(pending.length,1,'Overlapping reads share one network request');
 pending.shift().resolve(Response.json([{id:'a'}]));
 assert.deepEqual(await a,await b);
 const first=api('services');setChurchContext('church-b');const second=api('services');
 assert.equal(pending.length,2,'Two churches never share a read');
 assert.equal(pending[0].init.headers['X-Church-Id'],'church-a');
 assert.equal(pending[1].init.headers['X-Church-Id'],'church-b');
 pending.shift().resolve(Response.json([{id:'a'}]));pending.shift().resolve(Response.json([{id:'b'}]));
 assert.notDeepEqual(await first,await second);

 const old=api('services');const write=api('services','POST',{title:'new'});const fresh=api('services');
 assert.equal(pending.length,3,'A write invalidates pre-write in-flight reads');
 pending.shift().resolve(Response.json([]));pending.shift().resolve(Response.json({id:'new'}));pending.shift().resolve(Response.json([{id:'new'}]));
 await Promise.all([old,write,fresh]);
 const failure=api('me');pending.shift().resolve(Response.json({error:'expired'},{status:401}));await assert.rejects(()=>failure,e=>e.status===401);
 const retry=api('me');assert.equal(pending.length,1,'Failed reads are evicted');pending.shift().resolve(Response.json({ok:true}));await retry;
}finally{globalThis.fetch=originalFetch;setChurchContext('')}
console.log('PASS: active/inactive team visibility, search, network failure, bounded timeout without write retry, same-church read deduplication and church/mutation isolation.');
