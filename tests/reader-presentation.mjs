import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as layout from '../lib/reader-layout.ts';
import * as fullscreen from '../lib/reader-fullscreen.ts';
import * as scoreViews from '../lib/score-views.ts';
import * as pairsDomain from '../lib/reader-pairs.ts';
import {newSong,newWorship} from '../lib/types.ts';

const song=(id,count)=>({...newSong(),id,title:`찬양 ${id}`,pages:Array.from({length:count},(_,n)=>({id:`${id}-${n}`,width:900,height:1250})),exports:Array.from({length:count},(_,n)=>`${id}-export-${n}`)});
const songs=[song('a',1),song('b',3),song('c',1)];
const service={id:'week',date:'2026-10-25',title:'주일예배',version:4,data:{...newWorship(),songs}};
const pages=layout.readerPages(service);
assert.deepEqual(pages.map(p=>p.page.id),['a-0','b-0','b-1','b-2','c-0']);
for(const total of [0,1,2,3,5,6])for(const columns of [1,2]){
 let index=0,seen=[];
 do{
  const span=layout.readerWindow(index,total,columns);
  seen.push(...Array.from({length:span.end-span.start},(_,i)=>span.start+i));
  const next=layout.readerStep(index,total,columns,1);
  if(next===index)break;
  index=next;
 }while(true);
 assert.deepEqual(seen,Array.from({length:total},(_,i)=>i),'Every page appears once in forward navigation, even with an odd total');
 assert.equal(layout.readerWindow(index,total,columns).next,false);
 assert.equal(layout.readerStep(0,total,columns,-1),0);
 assert.ok(layout.readerLast(total,columns)>=0);
}
assert.equal(layout.readerWindow(1,5,2).label,'2–3');
assert.equal(layout.readerWindow(4,5,2).label,'5');
for(const bad of ['invalid',NaN,Infinity,-4,null])assert.equal(layout.readerIndex(bad,5),0);
assert.equal(layout.readerIndex(2.8,5),2);assert.equal(layout.readerIndex(99,5),4);
for(const [width,height,expected] of [[1366,600,2],[1180,680,2],[1024,650,2],[820,1020,1],[390,500,1],[640,700,1]]){
 assert.equal(layout.readerColumns('auto',width,height),expected);
 assert.equal(layout.readerColumns('single',width,height),1);assert.equal(layout.readerColumns('double',width,height),2);
}
assert.equal(layout.readerKeyAction({key:' ',shiftKey:true},null),'previous');
assert.equal(layout.readerKeyAction({key:'Home'},null),'first');assert.equal(layout.readerKeyAction({key:'End'},null),'last');
for(const key of ['ArrowRight','ArrowLeft',' ','Home','End']){
 assert.equal(layout.readerKeyAction({key},{closest:()=>true}),null,'Inputs and selectors keep native keyboard behavior');
 assert.equal(layout.readerKeyAction({key,ctrlKey:true},null),null);
}
assert.equal(layout.readerKeyAction({key:' '},{closest:s=>s.includes('button')}),null,'Space must activate a focused button only once');
assert.equal(layout.readerSwipe({x:200,y:100},{x:100,y:104},1),1);
assert.equal(layout.readerSwipe({x:100,y:100},{x:200,y:104},1),-1);
assert.equal(layout.readerSwipe({x:200,y:100},{x:190,y:250},1),0);
assert.equal(layout.readerSwipe({x:200,y:100},{x:100,y:104},1.2),0);
assert.equal(layout.readerSwipe(null,{x:100,y:104},1),0);
console.log('PASS: ordered spreads across songs, odd/empty totals, bounded navigation, responsive columns, input-safe keys and pinch-safe swipes.');

let synchronouslyRequested=false;
const native={requestFullscreen(options){synchronouslyRequested=true;assert.equal(options.navigationUI,'hide');return Promise.resolve()}};
const pending=fullscreen.requestReaderFullscreen(native);assert.equal(synchronouslyRequested,true);assert.equal(await pending,true);
let legacy=false;assert.equal(await fullscreen.requestReaderFullscreen({webkitRequestFullscreen(){legacy=true}}),true);assert.equal(legacy,true);
assert.equal(await fullscreen.requestReaderFullscreen({}),false);
assert.equal(await fullscreen.requestReaderFullscreen({requestFullscreen:()=>Promise.reject(new Error('denied'))}),false);
let exitCount=0;
const foreign={},doc={fullscreenElement:foreign,exitFullscreen:async()=>{exitCount++}},element={ownerDocument:doc};
await fullscreen.exitReaderFullscreen(element);assert.equal(exitCount,0);
doc.fullscreenElement=element;await fullscreen.exitReaderFullscreen(element);assert.equal(exitCount,1);
console.log('PASS: immediate fullscreen gesture, standard/prefixed support, graceful denial and owned-element-only exit.');

// Run the actual reader's hooks and event handlers with a small DOM boundary.
// This checks behavior, not browser paint or native-device fullscreen behavior.
const require=createRequire(import.meta.url);
let scope;
const hooks={
 useState(initial){const at=scope.cursor++,owner=scope;owner.slots[at]??={value:typeof initial==='function'?initial():initial};return [owner.slots[at].value,value=>{owner.slots[at].value=typeof value==='function'?value(owner.slots[at].value):value}]},
 useRef(initial){const at=scope.cursor++;return scope.slots[at]??(scope.slots[at]={current:initial})},
 useEffect(run,deps){const at=scope.cursor++,owner=scope,old=owner.slots[at];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))owner.effects.push(()=>{old?.cleanup?.();owner.slots[at]={deps,cleanup:run()}})}
};
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),clear:()=>values.clear()}};
globalThis.sessionStorage=storage();globalThis.localStorage=storage();
const listeners=()=>{const map=new Map();return {addEventListener(type,fn){if(!map.has(type))map.set(type,new Set());map.get(type).add(fn)},removeEventListener(type,fn){map.get(type)?.delete(fn)},emit(type,event){for(const fn of map.get(type)||[])fn(event)},count(){return [...map.values()].reduce((a,s)=>a+s.size,0)}}};
globalThis.window={...listeners(),visualViewport:{scale:1}};
globalThis.document={...listeners(),visibilityState:'visible',fullscreenElement:null,async exitFullscreen(){this.fullscreenElement=null;this.emit('fullscreenchange')}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
const preloads=[];globalThis.Image=class{set src(url){preloads.push(url)}};
globalThis.Element=class{closest(){return null}};
let resize;globalThis.ResizeObserver=class{constructor(callback){resize=callback}observe(){}disconnect(){}};
const messages=[];
let currentView;
const pairPrefs={data:{pairs:[],revision:0,version:4,removed:0},error:'',loading:false,busy:false,refresh(){},async save(pairs){this.data={...this.data,pairs,revision:this.data.revision+1};return this.data}};
const profile={id:'me',name:'내 이름',position:'드럼'};
const makeView=(id='me')=>({serviceId:'week',version:4,userId:id,name:id,position:id==='me'?'드럼':'싱어',own:id==='me',members:[],songs:{a:{notes:[{id:'note-a',pageId:'a-0',text:`${id} 첫 곡 표시`}],basedVersion:4},b:{notes:[{id:'note-b',pageId:'b-0',text:`${id} 둘째 곡 표시`}],basedVersion:4}}});
currentView={view:makeView(),loading:false,error:null,refresh(){}};
const code=ts.transpileModule(readFileSync('app/rehearsal-reader.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const module={exports:{}};
const Preview=props=>React.createElement('div',{'data-score-page':props.page.id,'data-notes':JSON.stringify(props.notes)});
new Function('require','module','exports',code)(id=>{
 if(id==='react')return hooks;
 if(id==='@/lib/reader-layout')return layout;
 if(id==='@/lib/reader-pairs')return pairsDomain;
 if(id==='./use-reader-pairs')return {useReaderPairs:()=>pairPrefs};
 if(id==='./reader-pair-editor')return {__esModule:true,default:'ReaderPairEditor'};
 if(id==='@/lib/reader-fullscreen')return fullscreen;
 if(id==='@/lib/score-views')return scoreViews;
 if(id==='@/lib/client')return {fileUrl:id=>'/api/files/'+id};
 if(id==='sonner')return {toast:{info:message=>messages.push(message),success:message=>messages.push(message)}};
 if(id==='@/components/ui/dialog')return {Dialog:'Dialog',DialogTitle:'h2',DialogDescription:'p'};
 if(id==='./workbench-dialog')return {__esModule:true,default:'DialogContent'};
 if(id==='./score-view-selector')return {__esModule:true,default:'ScoreViewSelector',ScoreViewNotice:'ScoreViewNotice',useScoreView:()=>currentView};
 if(id==='./score-preview')return {__esModule:true,default:Preview};
 return require(id);
},module,module.exports);
const Reader=module.exports.default;
const tree=node=>React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(tree)]:[];
const byClass=(nodes,name)=>nodes.find(node=>node.props.className?.split(' ').includes(name));
const byLabel=(nodes,label)=>nodes.find(node=>node.props['aria-label']===label);
const state=()=>({cursor:0,slots:[],effects:[]});
const run=(fn,props,owner)=>{scope=owner;scope.cursor=0;return fn(props)};
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
let closed=0,bounds={width:1180,height:680};
const root={ownerDocument:document,requestFullscreen(){document.fullscreenElement=this;document.emit('fullscreenchange');return Promise.resolve()}};
const stage={getBoundingClientRect:()=>bounds,scrollTo(){},focus(){}};
const owner=state(),props={service,profile,churchId:'church-a',onClose(){closed++}};
function render(){let nodes=tree(run(Reader,props,owner));nodes.find(n=>n.type==='DialogContent').props.ref.current=root;if(byClass(nodes,'reader-stage'))byClass(nodes,'reader-stage').props.ref.current=stage;while(owner.effects.length)owner.effects.shift()();return nodes}
const visibleIds=nodes=>React.Children.toArray(byClass(nodes,'reader-spread')?.props.children).map(n=>n.props.item.page.id);
let nodes=render();nodes=render();assert.deepEqual(visibleIds(nodes),['a-0','b-0']);
assert.equal(byClass(nodes,'reader-spread').props['data-pages'],2);
assert.equal(preloads.length,3,'Initial single-page and measured double-page renders preload only their next windows');
const sheets=React.Children.toArray(byClass(nodes,'reader-spread').props.children);
for(const [n,pageId,note] of [[sheets[0],'a-0','me 첫 곡 표시'],[sheets[1],'b-0','me 둘째 곡 표시']]){
 const rendered=tree(run(n.type,n.props,state()));const preview=rendered.find(node=>node.type===Preview);
 assert.equal(preview.props.page.id,pageId);assert.equal(preview.props.notes[0].text,note);
 assert.ok(!rendered.some(node=>node.type==='img'),'Current notes must be rendered, not an old shared export');
}
byLabel(nodes,'다음 악보').props.onClick();nodes=render();assert.deepEqual(visibleIds(nodes),['b-1','b-2']);
byLabel(nodes,'다음 악보').props.onClick();nodes=render();assert.deepEqual(visibleIds(nodes),['c-0']);assert.equal(byLabel(nodes,'다음 악보').props.disabled,true);
byLabel(nodes,'이전 악보').props.onClick();nodes=render();assert.deepEqual(visibleIds(nodes),['b-1','b-2']);
byLabel(nodes,'한 화면에 볼 악보 수').props.onChange({target:{value:'single'}});nodes=render();assert.deepEqual(visibleIds(nodes),['b-1']);
byLabel(nodes,'한 화면에 볼 악보 수').props.onChange({target:{value:'double'}});nodes=render();assert.deepEqual(visibleIds(nodes),['b-1','b-2']);
assert.equal(localStorage.getItem('praise-reader-layout:church-a:me'),'double');
byLabel(nodes,'곡 바로 이동').props.onChange({target:{value:'b'}});nodes=render();assert.deepEqual(visibleIds(nodes),['b-0','b-1']);
byLabel(nodes,'악보 보기 크기').props.onChange({target:{value:'zoom'}});nodes=render();
byClass(nodes,'reader-present-button').props.onClick();nodes=render();await settle();
assert.ok(byClass(nodes,'reader-presenting'));assert.ok(byClass(nodes,'reader-fit-page'));assert.equal(document.fullscreenElement,root);
assert.ok(!byClass(nodes,'reader-controls')&&!byClass(nodes,'reader-view-panel'));
assert.ok(byClass(nodes,'reader-presentation-bar'),'Controls reserve space below the score');
assert.deepEqual(visibleIds(nodes),['b-0','b-1']);
byLabel(nodes,'다음 악보').props.onClick();nodes=render();assert.deepEqual(visibleIds(nodes),['b-2','c-0']);
let prevented=false;nodes.find(n=>n.type==='DialogContent').props.onEscapeKeyDown({preventDefault(){prevented=true}});nodes=render();await settle();
assert.equal(prevented,true);assert.equal(closed,0);assert.ok(!byClass(nodes,'reader-presenting'));assert.ok(byClass(nodes,'reader-fit-zoom'));assert.deepEqual(visibleIds(nodes),['b-2','c-0']);
byClass(nodes,'reader-present-button').props.onClick();nodes=render();await settle();await document.exitFullscreen();nodes=render();
assert.ok(!byClass(nodes,'reader-presenting'));assert.equal(closed,0,'Native Escape returns to reader without dismissing the dialog');
root.requestFullscreen=()=>Promise.reject(new Error('not supported'));
byClass(nodes,'reader-present-button').props.onClick();nodes=render();await settle();nodes=render();
assert.ok(byClass(nodes,'reader-presenting'));assert.ok(messages.length);
byClass(nodes,'reader-exit-presentation').props.onClick();nodes=render();assert.ok(!byClass(nodes,'reader-presenting'));
console.log('PASS: live reader cross-song spreads, paging, song jumps, layout/position memory, notes on both pages, presentation fit/exit and denied-fullscreen fallback.');

// Rotate/resize, use keyboard, and protect pinch gestures from changing pages.
byLabel(nodes,'한 화면에 볼 악보 수').props.onChange({target:{value:'auto'}});nodes=render();bounds={width:820,height:1020};resize();nodes=render();assert.deepEqual(visibleIds(nodes),['b-2']);
bounds={width:1180,height:680};resize();nodes=render();assert.deepEqual(visibleIds(nodes),['b-2','c-0']);
const key=(key,extra={})=>window.emit('keydown',{key,target:new Element(),preventDefault(){},...extra});
key('Home');nodes=render();assert.deepEqual(visibleIds(nodes),['a-0','b-0']);
key(' ');nodes=render();assert.deepEqual(visibleIds(nodes),['b-1','b-2']);
key(' ',{shiftKey:true});nodes=render();assert.deepEqual(visibleIds(nodes),['a-0','b-0']);
byLabel(nodes,'악보 보기 크기').props.onChange({target:{value:'page'}});nodes=render();
let area=byClass(nodes,'reader-stage');area.props.onTouchStart({touches:[{clientX:250,clientY:100}]});area.props.onTouchMove({touches:[{},{}]});area.props.onTouchEnd({touches:[],changedTouches:[{clientX:20,clientY:100}]});nodes=render();assert.deepEqual(visibleIds(nodes),['a-0','b-0']);
area=byClass(nodes,'reader-stage');area.props.onTouchStart({touches:[{clientX:250,clientY:100}]});area.props.onTouchEnd({touches:[],changedTouches:[{clientX:20,clientY:100}]});nodes=render();assert.deepEqual(visibleIds(nodes),['b-1','b-2']);
currentView={...currentView,view:null,loading:true};nodes=render();assert.equal(visibleIds(nodes).length,0,'No previous author pages while the next author loads');
currentView={...currentView,view:makeView('vocal'),loading:false};key('Home');nodes=render();
for(const sheet of React.Children.toArray(byClass(nodes,'reader-spread').props.children)){
 const rendered=tree(run(sheet.type,sheet.props,state()));assert.ok(rendered.find(n=>n.type===Preview).props.notes[0].text.startsWith('vocal'));
}
currentView={...currentView,view:null,error:'offline'};nodes=render();assert.ok(byClass(nodes,'reader-view-error'));assert.equal(visibleIds(nodes).length,0);
currentView={...currentView,view:makeView(),error:null};nodes=render();
// Common exports can fail independently; one failed page must not blank its neighbor.
const exportItem={...pages[2],song:{...pages[2].song,renderOnRead:false}};
const Sheet=React.Children.toArray(byClass(nodes,'reader-spread').props.children)[0].type;
const sheetState=state();let rendered=tree(run(Sheet,{item:exportItem,view:makeView(),service},sheetState));
rendered.find(n=>n.type==='img').props.onError();rendered=tree(run(Sheet,{item:exportItem,view:makeView(),service},sheetState));assert.ok(rendered.some(n=>n.type===Preview));
rendered=tree(run(Sheet,{item:{...exportItem,song:{...exportItem.song,renderOnRead:true}},view:makeView(),service},state()));assert.ok(rendered.some(n=>n.type===Preview),'Updated song form must bypass an old export');
const html=renderToStaticMarkup(run(Sheet,{item:pages[0],view:makeView(),service},state()));assert.ok(html.includes('me 첫 곡 표시'));
// User-picked pages stay paired through presentation; all other pages are singles.
pairPrefs.data={pairs:[[pairsDomain.readerPageRef(pages[3]),pairsDomain.readerPageRef(pages[0])]],revision:1,version:4,removed:0};
byLabel(nodes,'한 화면에 볼 악보 수').props.onChange({target:{value:'custom'}});nodes=render();key('Home');nodes=render();
assert.deepEqual(visibleIds(nodes),['b-2','a-0']);
byClass(nodes,'reader-present-button').props.onClick();nodes=render();await settle();assert.deepEqual(visibleIds(nodes),['b-2','a-0']);
byLabel(nodes,'다음 악보').props.onClick();nodes=render();assert.deepEqual(visibleIds(nodes),['b-0'],'Unpaired pages stay single, rather than being arbitrarily combined');
byClass(nodes,'reader-exit-presentation').props.onClick();nodes=render();
byClass(nodes,'reader-pair-entry').props.onClick();nodes=render();
assert.ok(nodes.find(n=>n.type==='ReaderPairEditor'));assert.ok(!byClass(nodes,'reader-stage'));
const editor=nodes.find(n=>n.type==='ReaderPairEditor');assert.equal(editor.props.initialPage.pageId,'b-0');
const chosen=[[pairsDomain.readerPageRef(pages[0]),pairsDomain.readerPageRef(pages[4])]];
await editor.props.onSave(chosen);nodes=render();assert.deepEqual(visibleIds(nodes),['a-0','c-0']);
byLabel(nodes,'합주 모드 닫기').props.onClick();assert.equal(closed,1);
owner.slots.forEach(slot=>slot.cleanup?.());assert.equal(window.count(),0);assert.equal(document.count(),0);
console.log('PASS: resize anchor retention, keyboard/swipe controls, author/loading/error separation, independent image fallback and event cleanup.');

const cssRequire=createRequire(require.resolve('@tailwindcss/postcss'));
const {transform}=cssRequire('lightningcss');
const compiled=transform({filename:'reader.css',code:Buffer.from(readFileSync('app/reader.css','utf8')),minify:true,targets:{safari:(15<<16)|(4<<8),chrome:100<<16}});
assert.equal(compiled.warnings.length,0);assert.ok(compiled.code.length>1000);
console.log('PASS: reader stylesheet compiles without warnings for Safari/Chrome targets (not a browser layout test).');
