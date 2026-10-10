import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as scoreViews from '../lib/score-views.ts';

// Exercise the actual hook with deferred requests, including responses arriving
// out of order. No DOM or production account is needed for this boundary.
const require=createRequire(import.meta.url),slots=[],effects=[],requests=[];
let cursor=0;
const hooks={
 useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value}]},
 useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial})},
 useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:run()}})}
};
const requestJson=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));
const code=ts.transpileModule(readFileSync('app/score-view-selector.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function load(react){const module={exports:{}};new Function('require','module','exports',code)(id=>id==='react'?react:id==='@/lib/api-response'?{requestJson}:id==='@/lib/score-views'?scoreViews:require(id),module,module.exports);return module.exports}
const {useScoreView}=load(hooks);
const profile={id:'me',name:'나',position:'드럼'},service={id:'week',version:3,data:{songs:[]}};
const answer=id=>({serviceId:'week',version:3,userId:id,name:id,position:'드럼',own:id==='me',members:[profile,{id:'drum',name:'같은 드럼',position:'드럼'},{id:'vocal',name:'보컬 이름',position:'싱어'}],songs:{}});
const render=(church='a')=>{cursor=0;return useScoreView(service,profile,church)};
const commit=()=>{while(effects.length)effects.shift()()};
const settle=async()=>{await Promise.resolve();await Promise.resolve()};
let state=render();commit();assert.equal(state.user,'me');assert.equal(state.loading,true);
assert.equal(requests[0].options.headers['X-Church-Id'],'a');assert.equal(requests[0].options.cache,'no-store');
requests[0].resolve(answer('me'));await settle();state=render();commit();assert.equal(state.view.userId,'me');
state.setUser('drum');state=render();assert.equal(state.view,null,'Old author must disappear immediately, before effects run');commit();
state.setUser('vocal');state=render();commit();requests[2].resolve(answer('vocal'));await settle();
state=render();assert.equal(state.view.userId,'vocal');
requests[1].resolve(answer('drum'));await settle();state=render();assert.equal(state.view.userId,'vocal','Late drum response cannot overwrite current vocal selection');
state.setUser('common');state=render();commit();requests[3].reject(new Error('연결 끊김'));await settle();state=render();
assert.equal(state.view,null);assert.equal(state.error,'연결 끊김','Load failure must not look like empty personal notes');
state.refresh();state=render();commit();assert.equal(state.error,'');assert.equal(state.loading,true);
requests[4].resolve({...answer(null),songs:{}});await settle();state=render();assert.equal(state.view.userId,null);
state=render('b');assert.equal(state.view,null,'Church switch immediately hides the previous church payload');commit();
assert.equal(requests[5].options.headers['X-Church-Id'],'b');
slots.forEach(s=>s.cleanup?.());requests[5].resolve(answer('me'));await settle();
console.log('PASS: immediate author/church isolation, out-of-order responses, error visibility, retry and unmount cleanup.');

const {default:Selector,ScoreViewNotice}=load(React);
const view=answer('vocal'),model={user:'vocal',members:view.members,loading:false,setUser(){},refresh(){}};
const html=renderToStaticMarkup(React.createElement(Selector,{model,profile}));
assert.ok(html.includes('악보 표시할 팀원 선택'));assert.ok(html.includes('팀원 악보 · 읽기 전용'));
assert.ok(html.includes('드럼 · 같은 드럼'));assert.ok(html.includes('보컬 · 보컬 이름'));
assert.ok(html.includes('공통 송폼 악보'));assert.ok(html.includes('selected=""'));
const readOnly=renderToStaticMarkup(React.createElement(ScoreViewNotice,{view,service}));
assert.ok(readOnly.includes('읽기 전용'));
console.log('PASS: accessible selector renders self, common and named teammates with read-only context.');
