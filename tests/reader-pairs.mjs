import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {readerPages} from '../lib/reader-layout.ts';
import * as pairs from '../lib/reader-pairs.ts';
import {newSong,newWorship} from '../lib/types.ts';
const require=createRequire(import.meta.url);
const service={id:'week',version:2,data:{...newWorship(),songs:[{...newSong(),id:'a',title:'은혜',pages:[{id:'same-file',width:900,height:1200},{id:'page-2',width:900,height:1200}]},{...newSong(),id:'b',title:'찬양',pages:[{id:'same-file',width:900,height:1200},{id:'page-4',width:900,height:1200},{id:'page-5',width:900,height:1200}]}]}};
const pages=readerPages(service),refs=pages.map(pairs.readerPageRef),chosen=[[refs[3],refs[0]],[refs[1],refs[4]]];
assert.deepEqual(pairs.personalReaderSpreads(pages,chosen),[[3,0],[1,4],[2]],'Nonconsecutive choices keep explicit left/right order; every remaining page is single');
assert.deepEqual(pairs.personalReaderFrame(0,pairs.personalReaderSpreads(pages,chosen)).indices,[3,0]);
assert.deepEqual(pairs.personalReaderFrame(3,pairs.personalReaderSpreads(pages,chosen)).indices,[3,0]);
assert.notEqual(pairs.readerPageKey(refs[0]),pairs.readerPageKey(refs[2]),'Same image reused by two songs is two distinct selectable pages');
assert.equal(pairs.validReaderPairs(pages,[[refs[0],refs[2]]]).removed,0);
assert.equal(pairs.validReaderPairs(pages,[[refs[0],refs[0]]]).removed,1);
assert.equal(pairs.validReaderPairs(pages,[[refs[0],refs[1]],[refs[1],refs[2]]]).removed,1);
const changed=pages.filter(page=>page.page.id!=='page-4');
const cleaned=pairs.validReaderPairs(changed,chosen);assert.equal(cleaned.removed,1);assert.deepEqual(cleaned.pairs,[chosen[1]]);
for(const combination of [[],chosen,[[refs[0],refs[2]]],[[refs[4],refs[2]],[refs[3],refs[1]]]]){
 const spreads=pairs.personalReaderSpreads(pages,combination);
 assert.deepEqual(spreads.flat().sort((a,b)=>a-b),[0,1,2,3,4]);
 let at=0,visited=[];
 while(true){const frame=pairs.personalReaderFrame(at,spreads);visited.push(...frame.indices);if(frame.nextIndex===null)break;at=frame.nextIndex}
 assert.deepEqual(visited,spreads.flat());
 assert.equal(pairs.personalReaderFrame(0,spreads).previousIndex,null);
}
console.log('PASS: selected nonadjacent pages, left/right order, reused files, duplicate rejection, removed-page recovery and complete navigation.');

const slots=[],effects=[];let cursor=0;
const reset=()=>{slots.forEach(s=>s.cleanup?.());slots.length=0;effects.length=0;cursor=0};
const hooks={
 useState(initial){const at=cursor++;slots[at]??={value:typeof initial==='function'?initial():initial};return [slots[at].value,next=>{slots[at].value=typeof next==='function'?next(slots[at].value):next}]},
 useRef(initial){const at=cursor++;return slots[at]??(slots[at]={current:initial})},
 useEffect(run,deps){const at=cursor++,old=slots[at];if(!old||deps.some((dep,i)=>!Object.is(dep,old.deps[i])))effects.push(()=>{old?.cleanup?.();slots[at]={deps,cleanup:run()}})}
};
const requests=[];const requestJson=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));
function load(file,react=hooks){
 const output=ts.transpileModule(readFileSync(file,'utf8'),{reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 assert.equal(output.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file+' syntax');
 const module={exports:{}};
 new Function('require','module','exports',output.outputText)(id=>id==='react'?react:id==='@/lib/reader-pairs'?pairs:id==='@/lib/client'?{fileUrl:id=>'/api/files/'+id}:id==='@/lib/api-response'?{requestJson}:require(id),module,module.exports);return module.exports;
}
const commit=()=>{while(effects.length)effects.shift()()};
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
const {useReaderPairs}=load('app/use-reader-pairs.ts');
const renderHook=(church='a',user='me')=>{cursor=0;return useReaderPairs('week',2,church,user)};
const data=(selected=[],revision=0)=>({pairs:selected,revision,version:2,basedVersion:2,removed:0});
let model=renderHook();commit();assert.equal(model.loading,true);assert.equal(requests[0].options.headers['X-Church-Id'],'a');assert.equal(requests[0].options.cache,'no-store');
requests[0].resolve(data(chosen,1));await settle();model=renderHook();commit();assert.deepEqual(model.data.pairs,chosen);
const saving=model.save([[refs[0],refs[2]]]);assert.equal(JSON.parse(requests[1].options.body).revision,1);assert.equal(await model.save([]),null,'Repeated taps cannot create parallel saves');
model=renderHook();assert.equal(model.busy,true);requests[1].reject(Object.assign(new Error('다른 기기에서 변경'),{status:409}));await saving;model=renderHook();assert.equal(model.busy,false);assert.equal(model.error,'다른 기기에서 변경');assert.deepEqual(model.data.pairs,chosen,'Conflict keeps last loaded settings and does not claim success');
model.refresh();model=renderHook();commit();requests[2].resolve(data(chosen,2));await settle();model=renderHook();commit();assert.equal(model.error,'');
const retry=model.save([[refs[0],refs[2]]]);requests[3].resolve(data([[refs[0],refs[2]]],3));await retry;model=renderHook();assert.equal(model.data.revision,3);
model=renderHook('b');assert.equal(model.data,null,'Previous church settings disappear before effects run');commit();
model=renderHook('b','someone-else');assert.equal(model.data,null);commit();requests[5].resolve(data([],0));await settle();model=renderHook('b','someone-else');commit();requests[4].resolve(data(chosen,10));await settle();model=renderHook('b','someone-else');assert.deepEqual(model.data.pairs,[],'Late prior-user response cannot replace this account');
reset();console.log('PASS: account/church isolation, scoped network requests, concurrent-tap lock, conflict/error recovery and out-of-order response guards.');

const Editor=load('app/reader-pair-editor.tsx').default;
const tree=node=>React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(tree)]:[];
const text=node=>React.isValidElement(node)?React.Children.toArray(node.props.children).map(text).join(''):String(node??'');
let saved,focus,cancelled=0;
const props={pages,initialPairs:[],initialPage:refs[0],saving:false,error:'',removed:0,onSave:(next,ref)=>{saved=next;focus=ref},onCancel:()=>cancelled++,onReload(){}};
const render=()=>{cursor=0;return tree(Editor(props))};
const button=(nodes,label)=>nodes.find(node=>node.type==='button'&&text(node)===label);
let nodes=render();assert.equal(nodes.filter(n=>n.props['aria-pressed']===true).length,1);assert.equal(button(nodes,'저장하고 보기').props.disabled,true);
nodes.find(n=>n.props['aria-label']==='찬양 1페이지').props.onClick();nodes=render();assert.equal(button(nodes,'저장하고 보기').props.disabled,false);
assert.equal(nodes.find(n=>n.props['aria-label']==='찬양 2페이지').props.disabled,true,'A pair cannot silently take a third page');
button(nodes,'묶음 추가').props.onClick();nodes=render();assert.equal(nodes.find(n=>n.props['aria-label']==='은혜 1페이지 · 묶음 1').props.disabled,true);
nodes.find(n=>n.props['aria-label']==='1번 묶음 좌우 바꾸기').props.onClick();nodes=render();button(nodes,'저장하고 보기').props.onClick();assert.deepEqual(saved,[[refs[2],refs[0]]]);assert.deepEqual(focus,refs[2]);
nodes.find(n=>n.props['aria-label']==='1번 묶음 해제').props.onClick();nodes=render();button(nodes,'저장하고 보기').props.onClick();assert.deepEqual(saved,[],'Clearing all pairs is a persisted explicit choice');
nodes.find(n=>n.props['aria-label']==='두 장으로 볼 곡 검색').props.onChange({target:{value:'은혜'}});nodes=render();assert.equal(nodes.filter(n=>n.props.className?.split(' ').includes('reader-page-choice')).length,2);
button(nodes,'취소').props.onClick();assert.equal(cancelled,1);assert.deepEqual(props.initialPairs,[],'Editor draft never mutates saved props');
const RealEditor=load('app/reader-pair-editor.tsx',React).default;
const html=renderToStaticMarkup(React.createElement(RealEditor,{...props,initialPairs:chosen,initialPage:undefined}));assert.ok(html.includes('내 계정에 저장'));assert.ok(html.includes('패드와 노트북'));assert.ok(html.includes('1번 묶음 좌우 바꾸기'));assert.ok(html.includes('저장하고 보기'));
console.log('PASS: personal-page seed, exactly two choices, multiple-pair drafts, left/right swap, ungroup/save, search, cancellation and accessible controls.');
