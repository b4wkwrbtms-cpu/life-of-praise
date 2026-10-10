import assert from 'node:assert/strict';
import {DraftSaveQueue,draftPrefix,readDraftBackups,writeDraftBackup,removeDraftBackup,sameDraft,isDraft,saveDraftWithReconciliation,saveStateText} from '../lib/draft-recovery.ts';
import {newWorship,newSong} from '../lib/types.ts';
const base=newWorship();base.songs=[{...newSong(),title:'은혜',pages:[{id:'page1',width:1000,height:1500}]}];
const edit=structuredClone(base);edit.songs[0].notes='건반만 먼저 시작';
const latest=structuredClone(edit);latest.songs[0].notes='건반 먼저 시작 → Cx2';
class MemoryStorage{map=new Map();get length(){return this.map.size}key(i){return [...this.map.keys()][i]??null}getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,v)}removeItem(k){this.map.delete(k)}}
const storage=new MemoryStorage(),scope={userId:'leaderA',churchId:'churchA',serviceId:'service1'};
const record=(id,data=edit,updated=1)=>({format:1,id,updated,revision:1,base,data});
writeDraftBackup(storage,scope,record('tab1'));
writeDraftBackup(storage,scope,record('tab2',latest,2));
writeDraftBackup(storage,{...scope,userId:'leaderB'},record('tab3'));
writeDraftBackup(storage,{...scope,churchId:'churchB'},record('tab4'));
writeDraftBackup(storage,{...scope,serviceId:'service2'},record('tab5'));
assert.deepEqual(readDraftBackups(storage,scope,base).map(r=>r.id),['tab2','tab1']);
removeDraftBackup(storage,scope,'tab1');
assert.deepEqual(readDraftBackups(storage,scope,base).map(r=>r.id),['tab2'],'one tab never removes another');
assert.equal(readDraftBackups(storage,scope,latest).length,0,'confirmed server snapshot is not resurrected later');
assert.equal(storage.getItem(draftPrefix(scope)+'tab2'),null);
storage.setItem(draftPrefix(scope)+'broken','{broken');
storage.setItem(draftPrefix(scope)+'invalid',JSON.stringify({...record('invalid'),data:{songs:[]}}));
assert.deepEqual(readDraftBackups(storage,scope,base),[]);
const unfinished=structuredClone(base);unfinished.title='';unfinished.songs[0].link='https:/';
assert.ok(isDraft(unfinished),'unfinished input is recoverable, not silently thrown away');
assert.equal(isDraft({...base,songs:[{...base.songs[0],pages:[{id:'p',width:NaN,height:1}]}]}),false);
assert.ok(sameDraft({a:1,b:2,optional:undefined},{b:2,a:1}));
assert.ok(!sameDraft([1,2],[2,1]));
assert.throws(()=>writeDraftBackup({setItem(){throw new Error('quota')}},scope,record('quota')),/quota/);
console.log('PASS: account/church/service isolation, multiple tabs, confirmed backup cleanup, damaged records, unfinished text and unavailable storage.');

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let states=[],backups=[],calls=[],online=true,network=deferred();
const queue=new DraftSaveQueue({data:base,revision:1,online:()=>online,write:(data,revision)=>{calls.push({data,revision});return network.promise},checkpoint:(data,base,revision,dirty)=>{backups.push(structuredClone({data,base,revision,dirty}));return dirty},changed:s=>states.push({...s})});
queue.update(edit);const first=queue.flush();assert.equal(queue.flush(),first,'concurrent close/save/publish use one save queue');
await tick();assert.equal(calls.length,1);
queue.update(latest);assert.equal(queue.state.phase,'saving');
const next=deferred();const oldNetwork=network;network=next;oldNetwork.resolve({revision:2});
await tick();assert.equal(calls.length,2);assert.equal(calls[1].revision,2);assert.ok(sameDraft(calls[1].data,latest));
assert.equal(states.filter(s=>s.phase==='saved').length,0,'no premature saved label while newer edits are waiting');
assert.equal(backups.at(-1).dirty,true);assert.ok(sameDraft(backups.at(-1).data,latest));
next.resolve({revision:3});await first;assert.equal(queue.state.phase,'saved');assert.equal(queue.dirty,false);assert.equal(backups.at(-1).dirty,false);
await queue.flush();assert.equal(calls.length,2,'unchanged reading does not write');
console.log('PASS: serialized saves, edits during saving, truthful save state and latest unsaved snapshot retained.');

online=false;queue.update(edit);await assert.rejects(queue.flush(),/인터넷/);assert.equal(queue.state.phase,'offline');assert.ok(queue.state.backup);assert.ok(saveStateText(queue.state).includes('기기에'));
online=true;network=Promise.resolve({revision:4}); // custom network below uses a deferred shape
network={promise:Promise.resolve({revision:4})};await queue.flush();assert.equal(queue.revision,4);
let conflictCalls=0;const conflict=Object.assign(new Error('다른 창 변경'),{status:409});
const blocked=new DraftSaveQueue({data:base,revision:1,online:()=>true,write:async()=>{conflictCalls++;throw conflict},checkpoint:()=>true,changed:()=>{}});
blocked.update(edit);await assert.rejects(blocked.flush(),/다른 창/);blocked.update(latest);await assert.rejects(blocked.flush(),/다른 창/);assert.equal(conflictCalls,1,'a conflict never blindly retries or overwrites');assert.equal(blocked.state.phase,'conflict');
let rejected=0;const failed=new DraftSaveQueue({data:base,revision:1,online:()=>true,write:async()=>{rejected++;throw Object.assign(new Error('로그인 만료'),{status:401})},checkpoint:()=>false,changed:()=>{}});
failed.update(edit);await assert.rejects(failed.flush(),/로그인/);assert.equal(failed.state.backup,false);assert.ok(saveStateText(failed.state).includes('창을 유지'));assert.equal(rejected,1);
console.log('PASS: offline edits, reconnect saving, stale revisions blocked, authentication failure and truthful missing-backup notices.');

// Reverting during a request must remain recoverable even though it equals the old server data.
let revertNetwork=deferred(),revertCalls=0,revertBackups=[];
const reverted=new DraftSaveQueue({data:base,revision:1,online:()=>true,write:()=>{revertCalls++;return revertNetwork.promise},checkpoint:(data,base,revision,dirty)=>{revertBackups.push({data:structuredClone(data),dirty});return dirty},changed:()=>{}});
reverted.update(edit);const saving=reverted.flush();await tick();reverted.update(base);assert.ok(revertBackups.at(-1).dirty);assert.ok(sameDraft(revertBackups.at(-1).data,base));
const pendingRevert=revertNetwork;revertNetwork=deferred();pendingRevert.resolve({revision:2});await tick();assert.equal(revertCalls,2);revertNetwork.resolve({revision:3});await saving;assert.ok(sameDraft(reverted.base,base));
const unknown=deferred();const uncertain=new DraftSaveQueue({data:base,revision:1,online:()=>true,write:()=>unknown.promise,checkpoint:(_d,_b,_r,dirty)=>dirty,changed:()=>{}});
uncertain.update(edit);const uncertainSave=uncertain.flush();await tick();uncertain.update(base);unknown.reject(Object.assign(new Error('시간 초과'),{status:408}));await assert.rejects(uncertainSave);assert.ok(uncertain.dirty&&uncertain.state.backup,'reversion retained after unknown server outcome');
console.log('PASS: undo during in-flight save, server acknowledgement order, timeout does not erase reverted work.');

for(const [fresh,success] of [[{id:'service1',revision:5,draft:edit},true],[{id:'service1',revision:5,draft:latest},false],[{id:'service2',revision:5,draft:edit},false]]){
 let paths=[];const request=async(path,method)=>{paths.push([path,method]);if(method==='PUT')throw conflict;return [fresh]};
 const p=saveDraftWithReconciliation(request,'service1',edit,1);
 if(success)assert.equal((await p).revision,5);else await assert.rejects(p,e=>e===conflict);
 assert.deepEqual(paths,[['services/service1','PUT'],['services',undefined]],'reconciliation reads only, never overwrites a different server draft');
}
console.log('PASS: lost save response reconciles identical content only; real conflicts and other services remain protected.');
