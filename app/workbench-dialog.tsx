'use client';
import {useEffect,useState,type ComponentProps} from 'react';
import {DialogContent} from '@/components/ui/dialog';
import {measureWorkbenchViewport,type WorkbenchViewport} from '@/lib/editor-navigation';

// Viewport-sized workbenches must never inherit a centered dialog's -50% offset.
// Remove the utility classes as well as setting explicit coordinates: Safari can
// otherwise retain individual translate values during dialog/viewport changes.
export default function WorkbenchDialog({className='',style,fitVisualViewport=false,...props}:ComponentProps<typeof DialogContent>&{fitVisualViewport?:boolean}){
 const [viewport,setViewport]=useState<WorkbenchViewport|null>(null);
 useEffect(()=>{
  if(!fitVisualViewport)return;
  const visual=window.visualViewport;let frame=0;
  const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(visual&&Math.abs(visual.scale-1)>.02)return;
   const next=measureWorkbenchViewport(window.innerWidth,visual);
   setViewport(previous=>previous?.height===next?.height&&previous?.top===next?.top?previous:next);
  })};
  measure();visual?.addEventListener('resize',measure);visual?.addEventListener('scroll',measure);window.addEventListener('resize',measure);
  return()=>{cancelAnimationFrame(frame);visual?.removeEventListener('resize',measure);visual?.removeEventListener('scroll',measure);window.removeEventListener('resize',measure)};
 },[fitVisualViewport]);
 return <DialogContent {...props} data-compact-viewport={viewport&&viewport.height<500?true:undefined} className={'inset-0 translate-x-0 translate-y-0 data-[state=open]:animate-none data-[state=closed]:animate-none '+className} style={{...style,position:'fixed',inset:0,top:viewport?.top??0,left:0,right:0,bottom:viewport?'auto':0,...(viewport?{height:viewport.height,maxHeight:viewport.height}:{}),margin:0,transform:'none',translate:'0px 0px',animation:'none'}}/>;
}
