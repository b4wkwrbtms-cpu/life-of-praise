'use client';
import {useEffect,useRef,useState} from 'react';
import {renderScore,type Geometry,type Box} from '@/lib/client';
import type {ScorePage,Song,Note} from '@/lib/types';
import {FileMusic} from 'lucide-react';

type Props={page?:ScorePage;song:Song;notes?:Note[];meta?:string;selected?:string;onSelect?:(id:string)=>void;onMove?:(id:string,x:number,y:number)=>void;onMoveStart?:()=>void;onPlace?:(x:number,y:number)=>void;placing?:boolean;zoom?:number;selectedMarker?:string;onMarkerSelect?:(id:string)=>void;onMarkerMove?:(id:string,x:number,y:number)=>void;onMarkerPlace?:(x:number,y:number)=>void;editing?:boolean;onFormMove?:(x:number,y:number)=>void;formSelected?:boolean};
type Gesture={pointer:number;kind:'marker'|'note'|'form'|'place';id:string;rect:DOMRect;geometry:Geometry;startX:number;startY:number;x:number;y:number;originX:number;originY:number;box?:Box;moved:boolean};
const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));
export default function ScorePreview({page,song,notes=[],meta='',selected,onSelect,onMove,onMoveStart,onPlace,placing=false,zoom=100,selectedMarker,onMarkerSelect,onMarkerMove,onMarkerPlace,editing=false,onFormMove,formSelected=false}:Props){
 const ref=useRef<HTMLCanvasElement>(null),ghost=useRef<HTMLCanvasElement>(null),geo=useRef<Geometry|null>(null),gesture=useRef<Gesture|null>(null),frame=useRef(0);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[aspect,setAspect]=useState<number>();
 const current=useRef(0),interactive=editing||placing;
 const clear=()=>{gesture.current=null;cancelAnimationFrame(frame.current);if(ghost.current)ghost.current.style.display='none';};
 useEffect(()=>{clear();},[page?.id,interactive]);
 useEffect(()=>()=>clear(),[]);
 useEffect(()=>{
  if(!page||!ref.current)return;let active=true;const ticket=++current.current;setBusy(true);
  const c=document.createElement('canvas');
  renderScore(c,page,song,notes,meta).then(g=>{
   if(!active||ticket!==current.current||!ref.current)return;
   const target=ref.current;target.width=c.width;target.height=c.height;
   const ctx=target.getContext('2d')!;ctx.drawImage(c,0,0);
   const box=formSelected?g.formBox:selectedMarker?g.markerBoxes.find(b=>b.id===selectedMarker):g.noteBoxes.find(b=>b.id===selected);
   if(box&&interactive){ctx.strokeStyle='#c48748';ctx.lineWidth=3;ctx.setLineDash([6,5]);ctx.strokeRect(box.x-3,box.y-3,box.w+6,box.h+6);}
   geo.current=g;setAspect(g.width/g.height);
   setError(g.overflow?'송폼이 악보 아래로 벗어납니다. 위치를 올리거나 상단 여백을 켜 주세요.':'');setBusy(false);
  }).catch(e=>{if(active){setError(e.message);setBusy(false)}});
  return()=>{active=false};
 },[page?.id,JSON.stringify(page?.layout),JSON.stringify(song.layout),JSON.stringify(song.form),JSON.stringify(notes),meta,selected,JSON.stringify(song.markers),selectedMarker,formSelected,interactive]);
 const down=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  if(!interactive||!geo.current||e.button!==0||gesture.current||busy)return;
  const g=geo.current,r=e.currentTarget.getBoundingClientRect(),px=(e.clientX-r.left)*g.width/r.width,py=(e.clientY-r.top)*g.height/r.height;
  const hit=(b:Box)=>px>=b.x-8*g.width/r.width&&px<=b.x+b.w+8*g.width/r.width&&py>=b.y-8*g.width/r.width&&py<=b.y+b.h+8*g.width/r.width;
  let box:Box|undefined,kind:Gesture['kind']='place';
  if(!placing){
   if(onMarkerMove&&(box=[...g.markerBoxes].reverse().find(hit))){kind='marker';onMarkerSelect?.(box.id)}
   else if(onMove&&(box=[...g.noteBoxes].reverse().find(hit))){kind='note';onSelect?.(box.id)}
   else if(onFormMove&&g.formBox&&hit(g.formBox)){box=g.formBox;kind='form'}
   else{onSelect?.('');onMarkerSelect?.('');return}
  }
  // Snapshot bounds once; commit only on release, so autosave cannot move the page mid-drag.
  const originX=box?(box.x-g.offsetX)/g.rawWidth:0,originY=box?(box.y-(kind==='form'?0:g.offset))/g.rawHeight:0;
  gesture.current={pointer:e.pointerId,kind,id:box?.id||'',rect:r,geometry:g,startX:e.clientX,startY:e.clientY,x:originX,y:originY,originX,originY,box,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
  if(box&&ghost.current){const c=ghost.current;c.width=Math.ceil(box.w);c.height=Math.ceil(box.h);c.getContext('2d')!.drawImage(e.currentTarget,box.x,box.y,box.w,box.h,0,0,box.w,box.h);Object.assign(c.style,{display:'block',left:box.x/g.width*100+'%',top:box.y/g.height*100+'%',width:box.w/g.width*100+'%',height:box.h/g.height*100+'%',transform:'translate(0,0)'});}
 };
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const d=gesture.current;if(!d||d.pointer!==e.pointerId)return;
  const dx=e.clientX-d.startX,dy=e.clientY-d.startY;d.moved ||=Math.hypot(dx,dy)>5;
  if(d.kind==='place')return;
  const g=d.geometry;
  d.x=clamp(d.originX+dx*g.width/d.rect.width/g.rawWidth,Math.min(.98,Math.max(0,(g.rawWidth-(d.box?.w||0))/g.rawWidth)));
  d.y=clamp(d.originY+dy*g.height/d.rect.height/g.rawHeight,Math.min(.97,Math.max(0,(g.rawHeight-(d.box?.h||0))/g.rawHeight)));
  cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{if(ghost.current&&gesture.current===d)ghost.current.style.transform='translate('+((d.x-d.originX)*g.rawWidth*d.rect.width/g.width)+'px,'+((d.y-d.originY)*g.rawHeight*d.rect.height/g.height)+'px)';});
 };
 const up=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const d=gesture.current;if(!d||d.pointer!==e.pointerId)return;move(e);clear();
  if(d.kind==='place'){
   // Swipes and cancelled gestures never create annotations.
   if(!d.moved){const g=d.geometry,px=(e.clientX-d.rect.left)*g.width/d.rect.width,py=(e.clientY-d.rect.top)*g.height/d.rect.height;
   if(py>=g.offset&&py<=g.offset+g.rawHeight)(onMarkerPlace||onPlace)?.(clamp((px-g.offsetX)/g.rawWidth,.94),clamp((py-g.offset)/g.rawHeight,.97));}
  }else if(d.moved){onMoveStart?.();if(d.kind==='marker')onMarkerMove?.(d.id,d.x,d.y);else if(d.kind==='form')onFormMove?.(d.x,d.y);else onMove?.(d.id,d.x,d.y)}
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 if(!page)return <div className="score-placeholder"><FileMusic size={42} strokeWidth={1}/><strong>악보를 올리면 여기에 보여요</strong><span>곡 · 송폼 설정에서 악보를 추가해 주세요.</span></div>;
 return <div className="score-preview-wrap"><div className="score-scroll"><div className="score-paper" style={{width:zoom+'%',minWidth:zoom+'%',position:'relative',aspectRatio:aspect??page.width/(page.height+54)}}>
  <canvas aria-label="송폼, 구간 표시와 연주 표시가 합성된 악보 미리보기" ref={ref} style={{cursor:placing?'crosshair':interactive?'grab':'default',touchAction:interactive?'none':'pan-x pan-y pinch-zoom'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={clear} onLostPointerCapture={clear}/>
  <canvas ref={ghost} className="score-drag-ghost" aria-hidden="true"/>
 </div></div>{busy&&<small className="render-status" role="status">미리보기 반영 중…</small>}{error&&<div className="score-render-error" role="alert">{error}</div>}</div>;
}
