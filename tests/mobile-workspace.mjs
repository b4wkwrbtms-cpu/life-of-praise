import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as domain from '../lib/types.ts';

const require=createRequire(import.meta.url);
let cursor=0,slots=[],effects=[];
const reset=()=>{cursor=0;slots=[];effects=[]};
const hooks={
 useState(initial){const i=cursor++;slots[i]??={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value}]},
 useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial})},
 useId(){const i=cursor++;return `id-${i}-`},
 useCallback(fn){cursor++;return fn},
 useLayoutEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:run()}})},
 useEffect(){cursor++}
};
const stubs=new Map();
const stub=name=>{if(!stubs.has(name))stubs.set(name,Object.assign(()=>null,{displayName:name}));return stubs.get(name)};
function load(file,mocks={}){
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(id=>{
  if(id in mocks)return mocks[id];
  if(id==='react')return hooks;
  if(id==='@/lib/types')return domain;
  if(id==='@/lib/client')return {api:()=>{throw new Error('Unexpected network request')},fileUrl:id=>'/api/files/'+id};
  if(id==='sonner')return {toast:{error:()=>{},success:()=>{}}};
  if(id.startsWith('@/components/')||id==='./ui')return new Proxy({},{get:(_,key)=>stub(String(key))});
  if(id.startsWith('./'))return {default:stub(id),__esModule:true};
  return require(id);
 },module,module.exports);
 return module.exports;
}
const commit=()=>{while(effects.length)effects.shift()()};
const tree=node=>React.isValidElement(node)?[node,...React.Children.toArray(node.props.children).flatMap(tree)]:[];
const render=(fn,props)=>{cursor=0;return fn(props)};
const byClass=(nodes,name)=>nodes.find(n=>n.props.className?.split(' ').includes(name));

// Exercise the live navigation hook: no church/account can inherit the prior
// workspace's scroll position, and dialogs/re-renders do not reset a tab.
globalThis.window={scrollY:0,scrollTo({top}){this.scrollY=top}};
const {useWorkspaceNavigation}=load('app/use-workspace-navigation.ts');
const nav=scope=>{cursor=0;const state=useWorkspaceNavigation(scope);commit();return state};
let state=nav('church-a:me');window.scrollY=860;
state[1]('library');state=nav('church-a:me');assert.equal(state[0],'library');assert.equal(window.scrollY,0);
window.scrollY=420;state[1]('week');state=nav('church-a:me');assert.equal(window.scrollY,860);
state[1]('library');state=nav('church-a:me');assert.equal(window.scrollY,420);
window.scrollY=515;state=nav('church-a:me');assert.equal(window.scrollY,515,'Background refresh or closing a dialog must not move the list');
state[1]('library');assert.equal(window.scrollY,0,'Reselecting the active tab returns to its top');
window.scrollY=300;state[1]('week',{reset:true});state=nav('church-a:me');assert.equal(window.scrollY,0);
window.scrollY=700;state=nav('church-b:me');assert.equal(window.scrollY,0);
state[1]('library');state=nav('church-b:me');assert.equal(window.scrollY,0,'Church A library position must be forgotten');
window.scrollY=225;state=nav('church-b:another-user');assert.equal(window.scrollY,0);
console.log('PASS: tab return positions, active-tab top, explicit reset, refresh stability and church/account isolation.');

reset();
const Weekly=load('app/weekly-actions.tsx',{react:React}).default;
const calls=[];const weeklyProps={onRead:()=>calls.push('read'),onShare:()=>calls.push('share'),onDownload:()=>calls.push('download')};
const buttons=tree(Weekly(weeklyProps)).filter(n=>n.type==='button');
assert.equal(buttons.length,3);buttons.forEach(b=>b.props.onClick());assert.deepEqual(calls,['read','share','download']);
const html=renderToStaticMarkup(React.createElement(Weekly,weeklyProps));
assert.ok(html.includes('내 표시 · 팀원 악보도 함께')&&html.includes('악보 전체 저장'));

// Verify the real library creates the appropriate overflow actions for each
// role and preserves confirmation before any destructive operation.
const Library=load('app/library-panel.tsx').default;
const data=domain.newWorship();data.songs=[{...domain.newSong(),title:'긴 곡 이름도 한 줄씩 읽을 수 있는 찬양'}];
const service={id:'week',date:data.date,title:'우리 교회 예배',published:true,hasDraft:true,version:2,revision:4,data};
const libraryCalls=[];
const libraryProps={services:[service],admin:false,reload:async()=>{},onRead:()=>libraryCalls.push('read'),onShare:()=>libraryCalls.push('share'),onEdit:()=>libraryCalls.push('edit'),onCopy:()=>libraryCalls.push('copy'),onHistory:()=>libraryCalls.push('history')};
let nodes=tree(render(Library,libraryProps));
let menu=nodes.find(n=>n.type===stub('./action-menu'));assert.deepEqual(menu.props.items.map(i=>i.label),['이전 버전 보기']);
menu.props.items[0].run();assert.deepEqual(libraryCalls,['history']);
reset();nodes=tree(render(Library,{...libraryProps,admin:true}));menu=nodes.find(n=>n.type===stub('./action-menu'));
assert.deepEqual(menu.props.items.map(i=>i.label),['이전 버전 보기','새 주간으로 복사','수정 초안 버리기','휴지통으로 이동']);
menu.props.items.find(i=>i.label==='새 주간으로 복사').run();assert.equal(libraryCalls.at(-1),'copy');
menu.props.items.find(i=>i.label==='휴지통으로 이동').run();nodes=tree(render(Library,{...libraryProps,admin:true}));
assert.equal(nodes.find(n=>n.type===stub('AlertDialog')).props.open,true,'Deletion must still open the existing confirmation');
console.log('PASS: weekly action destinations and library role-specific actions; deletion still requires confirmation.');

reset();
const Fixed=load('app/fixed-songs.tsx').FixedSongList;
render(Fixed,{onAdd:()=>{}});
slots[1].value=[{id:'saved-song',title:'은혜',data:data.songs[0]}];slots[4].value=false;
nodes=tree(render(Fixed,{onAdd:()=>{}}));
let checkbox=nodes.find(n=>n.type==='input'&&n.props.type==='checkbox');
assert.ok(nodes.some(n=>n.type==='label'&&n.props.htmlFor===checkbox.props.id),'The entire card label must activate its native checkbox');
checkbox.props.onChange({target:{checked:true}});nodes=tree(render(Fixed,{onAdd:()=>{}}));
assert.equal(nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,true);
nodes=tree(render(Fixed,{onAdd:()=>{},existing:['saved-song']}));
assert.equal(nodes.find(n=>n.type==='input'&&n.props.type==='checkbox').props.disabled,true);
console.log('PASS: named full-card selection, selection persistence and already-added song restriction.');

reset();
const Studio=load('app/score-studio.tsx').default;
const studioProps={service,song:data.songs[0],profile:{id:'me',name:'팀원',position:'드럼'},latestVersion:2,onClose(){},onQuestion(){},onLatest(){},onReadAll(){},onEditForm(){}};
nodes=tree(render(Studio,studioProps));let toggle=byClass(nodes,'studio-tools-toggle');
assert.equal(toggle.props['aria-expanded'],false);assert.equal(nodes[1].props.fitVisualViewport,true);
assert.ok(nodes.some(n=>n.props.id===toggle.props['aria-controls']));
toggle.props.onClick();nodes=tree(render(Studio,studioProps));assert.equal(byClass(nodes,'studio-tools-toggle').props['aria-expanded'],true);
const presets=byClass(nodes,'cue-presets');React.Children.toArray(presets.props.children)[0].props.onClick();
nodes=tree(render(Studio,studioProps));assert.equal(byClass(nodes,'studio-tools-toggle').props['aria-expanded'],false,'Choosing a cue frees the score for placing it');
// Loading state initially replaces the preview, but cue placement state survives.
assert.ok(byClass(nodes,'placement-message'));
const modeButton=byClass(nodes,'studio-header').props.children[1].props.children[0];
modeButton.props.onClick();nodes=tree(render(Studio,studioProps));
assert.equal(byClass(nodes,'studio-tools-toggle').props['aria-expanded'],false);
byClass(nodes,'studio-tools-toggle').props.onClick();nodes=tree(render(Studio,studioProps));
assert.equal(byClass(nodes,'studio-tools-toggle').props['aria-expanded'],true,'Tool entry exits focus mode without losing the current cue');
assert.ok(byClass(nodes,'placement-message'));
console.log('PASS: persistent tool entry, focus-mode escape, automatic cue-tool collapse and cue preservation.');

// Compile the complete new stylesheet for mobile engines; this is syntax and
// compatibility validation, not a claim of browser layout or real-device QA.
const cssRequire=createRequire(require.resolve('@tailwindcss/postcss'));
const {transform}=cssRequire('lightningcss');
const css=transform({filename:'mobile.css',code:Buffer.from(readFileSync('app/mobile.css','utf8')),minify:true,targets:{safari:(15<<16)|(4<<8),chrome:100<<16}});
assert.equal(css.warnings.length,0);assert.ok(css.code.length>1000);
console.log('PASS: mobile stylesheet compiles for Safari 15.4+ and Chrome 100+ with no compatibility warnings.');
