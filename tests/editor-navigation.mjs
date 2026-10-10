import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {retainEditorLocation,measureWorkbenchViewport} from '../lib/editor-navigation.ts';

const before={songs:[{id:'a',pages:[{id:'a1'},{id:'a2'},{id:'a3'}]},{id:'b',pages:[{id:'b1'}]}]};
assert.deepEqual(retainEditorLocation(before,structuredClone(before),'a',2),{songId:'a',pageIndex:2},'Undo a position/size edit must stay on page 3');
const reordered=structuredClone(before);reordered.songs[0].pages.reverse();
assert.deepEqual(retainEditorLocation(before,reordered,'a',2),{songId:'a',pageIndex:0},'Follow the same page after undoing a page reorder');
assert.deepEqual(retainEditorLocation(before,{songs:[{id:'a',pages:[{id:'a1'}]}]},'a',2),{songId:'a',pageIndex:0},'Clamp when the displayed page no longer exists');
assert.deepEqual(retainEditorLocation(before,{songs:[before.songs[1]]},'a',2),{songId:'b',pageIndex:0});
assert.deepEqual(retainEditorLocation(before,{songs:[{id:'other',pages:[{id:'one'},{id:'two'},{id:'three'}]}]},'a',2),{songId:'other',pageIndex:0},'A replacement song starts at its first page');
assert.deepEqual(retainEditorLocation(before,{songs:[]},'a',2),{songId:'',pageIndex:0});
for(const [width,height,offsetTop] of [[393,756,0],[393,352,214],[844,350,0],[320,460,10]]){
 const frame=measureWorkbenchViewport(width,{height,offsetTop,scale:1});
 assert.equal(frame.top+frame.height,offsetTop+height,'Bottom navigation tracks the visible bottom during keyboard/rotation');
}
assert.equal(measureWorkbenchViewport(1280,{height:800,offsetTop:0,scale:1}),null,'Do not alter the desktop dialog');
assert.equal(measureWorkbenchViewport(393,{height:400,offsetTop:120,scale:2}),null,'Native pinch zoom is not counteracted');
assert.equal(measureWorkbenchViewport(393,null),null);
assert.equal(measureWorkbenchViewport(393,{height:0,offsetTop:0,scale:1}),null);
console.log('PASS: undo/redo retains the actual page, deletion fallbacks, keyboard/rotation geometry, desktop and native zoom boundaries.');

// Render actual presentational components, without a browser or production data.
const out=resolve('.sites-runtime/qa/ui');mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);
function compile(name){
 const source=readFileSync(resolve('app',name+'.tsx'),'utf8'),file=resolve(out,name+'.cjs');
 writeFileSync(file,ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
 return require(file).default;
}
const Nav=compile('editor-pane-nav'),Hero=compile('worship-hero');
for(const pane of ['score','details']){
 const markup=renderToStaticMarkup(React.createElement(Nav,{pane,onChange:()=>{}}));
 assert.equal((markup.match(/<button /g)||[]).length,2);
 assert.equal((markup.match(/aria-pressed="true"/g)||[]).length,1);
 assert.ok(markup.includes('곡 · 송폼 설정')&&markup.includes('악보 · 구간 표시'));
 assert.ok(!markup.includes('disabled=""'),'Autosave/pane changes do not disable navigation');
}
const locked=renderToStaticMarkup(React.createElement(Nav,{pane:'score',disabled:true,onChange:()=>{}}));
assert.equal((locked.match(/disabled=""/g)||[]).length,2);
for(const kind of ['week','entry']){
 const html=renderToStaticMarkup(React.createElement(Hero,{kind,title:'이번 주 찬양',description:'말씀과 찬양',actions:React.createElement('button',{},'예배 준비')}));
 assert.equal((html.match(/<h1/g)||[]).length,1);
 assert.ok(html.includes('worship-dawn-mobile.webp')&&html.includes('예배 준비'));
 assert.ok(html.includes('alt=""'),'Decorative generated photo is not described as a real church');
}
// Structural guard for the reported disappearing-navigation bug: the navigation
// must remain outside both the disabled fieldset and the score-focus hidden tree.
const editor=ts.createSourceFile('editor.tsx',readFileSync('app/worship-editor.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let seen=0;
function visit(node){
 if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(editor)==='EditorPaneNav'){
  seen++;
  for(let parent=node.parent;parent;parent=parent.parent){
   if(ts.isJsxElement(parent))assert.notEqual(parent.openingElement.tagName.getText(editor),'fieldset','Navigation must be outside the scroll/disabled fieldset');
  }
 }
 ts.forEachChild(node,visit);
}
visit(editor);assert.equal(seen,1,'Both panes must share one stable navigation component');
console.log('PASS: both mobile navigation states, operation lock, hero rendering, responsive assets and stable navigation placement.');
