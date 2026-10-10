import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
import {weekDownloadEntries,createScoreBundle,fetchScoreFile} from '../lib/week-download.ts';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCusAAAAASUVORK5CYII=','base64');
const page={id:'raw-not-used',width:1,height:1};
const service={id:'service',published:true,date:'2026-10-11',title:'주일예배',version:4,data:{songs:[
 {id:'a',title:'은혜',pages:[page,page],exports:['a1','a2']},
 {id:'b',title:'은혜',pages:[page],exports:['b1']},
 {id:'c',title:'../../주:하나님? / 찬양',pages:[page],exports:['a1']}
]},draft:{songs:[{id:'private',title:'미공개 수정본',pages:[page],exports:['never-read']}]}};
const original=JSON.stringify(service),entries=weekDownloadEntries(service);
assert.deepEqual(entries.map(x=>[x.songNumber,x.pageNumber,x.exportId]),[[1,1,'a1'],[1,2,'a2'],[2,1,'b1'],[3,1,'a1']]);
const calls=[],progress=[];
const bundle=await createScoreBundle(service,async entry=>{calls.push(entry.exportId);return new Blob([png],{type:'image/png'})},{onProgress:p=>progress.push(p)});
assert.equal(JSON.stringify(service),original,'The published service and its draft must remain untouched');
assert.equal(bundle.name,'2026-10-11_주일예배_v4_전체악보.zip');
assert.equal(bundle.pageCount,4);assert.equal(bundle.songCount,3);
assert.deepEqual(calls,['a1','a2','b1'],'Use published exports only and reuse a shared image once');
const archive=new Uint8Array(await bundle.blob.arrayBuffer()),files=unzipSync(archive),names=Object.keys(files);
assert.deepEqual(names,bundle.files.map(f=>f.name));
assert.deepEqual(names.slice(0,3),['01_은혜_p01.png','01_은혜_p02.png','02_은혜_p01.png']);
assert.ok(names.every(n=>!/[\\/:?]/.test(n)&&!n.startsWith('.')),'Do not create paths from song titles');
for(const [index,name] of names.entries()){
 assert.deepEqual(Buffer.from(files[name]),png,'Exact published score pixels/bytes are preserved');
 assert.deepEqual(Buffer.from(await bundle.files[index].arrayBuffer()),png);
 assert.equal(bundle.files[index].type,'image/png');
}
assert.equal(progress.at(-1).done,4);assert.equal(progress.at(-1).total,4);
mkdirSync('.sites-runtime/qa',{recursive:true});writeFileSync('.sites-runtime/qa/week-scores.zip',archive);

assert.throws(()=>weekDownloadEntries({...service,published:false}),/공개/);
assert.throws(()=>weekDownloadEntries({...service,data:{songs:[]}}),/없습니다/);
assert.throws(()=>weekDownloadEntries({...service,data:{songs:[{id:'missing',title:'없는 악보',pages:[page],exports:[]}]}}),/완성 악보/);
await assert.rejects(()=>createScoreBundle(service,async entry=>{if(entry.exportId==='a2')throw new Error('두 번째 파일 실패');return new Blob([png])}),/두 번째 파일 실패/);
await assert.rejects(()=>createScoreBundle(service,async()=>new Blob(['<html>login required</html>'])),/올바른 악보 이미지/);
await assert.rejects(()=>createScoreBundle(service,async()=>new Blob([png]),{maxBytes:png.length+1}),/전체 용량/);
const beforeStart=new AbortController();beforeStart.abort();let loads=0;
await assert.rejects(()=>createScoreBundle(service,async()=>{loads++;return new Blob([png])},{signal:beforeStart.signal}),e=>e.name==='AbortError');assert.equal(loads,0);
const midway=new AbortController();loads=0;
await assert.rejects(()=>createScoreBundle(service,async()=>{loads++;midway.abort();return new Blob([png])},{signal:midway.signal}),e=>e.name==='AbortError');assert.equal(loads,1,'Cancellation must stop later downloads');
console.log('PASS: all songs/pages in order, duplicate titles, safe Korean filenames, exact exported bytes, draft exclusion, cached repeated pages, progress, cancellation, byte limit and no partial success.');

const fetchOriginal=globalThis.fetch,timerOriginal=globalThis.setTimeout;
try{
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/files/test?church=church-a');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');return new Response(png,{headers:{'Content-Type':'image/png'}})};
 assert.equal((await fetchScoreFile('/api/files/test?church=church-a',new AbortController().signal)).size,png.length);
 globalThis.fetch=async()=>new Response('',{status:401});
 await assert.rejects(()=>fetchScoreFile('/file',new AbortController().signal),/로그인이 만료/);
 globalThis.fetch=async()=>new Response('',{status:404});
 await assert.rejects(()=>fetchScoreFile('/file',new AbortController().signal),/불러오지 못/);
 globalThis.fetch=async()=>{throw new TypeError('network')};
 await assert.rejects(()=>fetchScoreFile('/file',new AbortController().signal),/인터넷 연결/);
 globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
 const c=new AbortController(),cancelled=fetchScoreFile('/file',c.signal);c.abort();
 await assert.rejects(()=>cancelled,e=>e.name==='AbortError');
 globalThis.setTimeout=(fn,ms,...args)=>timerOriginal(fn,Math.min(ms,5),...args);
 await assert.rejects(()=>fetchScoreFile('/file',new AbortController().signal),/시간이 길어/);
}finally{globalThis.fetch=fetchOriginal;globalThis.setTimeout=timerOriginal}
console.log('PASS: church-scoped authenticated fetch, missing file, expired login, offline, timeout and abort handling.');

// A member form edit is rendered from the original score instead of an obsolete export.
const updatedWeek={...service,data:{songs:[{...service.data.songs[0],exports:[],renderOnRead:true}]}};
assert.deepEqual(weekDownloadEntries(updatedWeek).map(e=>e.exportId),['','']);
const renderedPages=[];const dynamicBundle=await createScoreBundle(updatedWeek,async entry=>{renderedPages.push(entry.pageNumber);return new Blob([png],{type:'image/png'})});
assert.deepEqual(renderedPages,[1,2],'Every freshly rendered page must be requested separately, not cached under an empty export ID');
assert.equal(dynamicBundle.pageCount,2);assert.equal(Object.keys(unzipSync(new Uint8Array(await dynamicBundle.blob.arrayBuffer()))).length,2);
console.log('PASS: newly edited song forms use dynamic page rendering in whole-week downloads without stale exports or page cache collisions.');
