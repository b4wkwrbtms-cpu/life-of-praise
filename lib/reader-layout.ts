import type {Service} from './types';

export type ReaderLayout = 'auto' | 'single' | 'double';
export type ReaderFit = 'page' | 'width' | 'zoom';
export function readerPages(service:Service) {
  return service.data.songs.flatMap((song,si)=>song.pages.map((page,pi)=>({song,si,page,pi})));
}
export type ReaderPage = ReturnType<typeof readerPages>[number];
export function readerIndex(value:unknown,total:number) {
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,Math.min(Math.max(0,total-1),Math.floor(number))):0;
}
export function readerLayout(value:unknown):ReaderLayout {
  return value==='single'||value==='double'?value:'auto';
}
export function readerColumns(layout:ReaderLayout,width:number,height:number):1|2 {
  if(layout==='single')return 1;
  if(layout==='double')return 2;
  return width>=760&&width>=height*1.15?2:1;
}
export function readerWindow(index:number,total:number,columns:number) {
  const start=readerIndex(index,total),end=Math.min(total,start+columns);
  return {start,end,previous:start>0,next:end<total,label:total?(end>start+1?`${start+1}–${end}`:String(start+1)):'0'};
}
export function readerStep(index:number,total:number,columns:number,direction:-1|1) {
  const window=readerWindow(index,total,columns);
  if(direction===1&&!window.next)return window.start;
  return readerIndex(window.start+direction*columns,total);
}
export function readerLast(total:number,columns:number) {
  return Math.max(0,Math.floor((total-1)/columns)*columns);
}
export function readerKeyAction(event:{key:string;shiftKey?:boolean;ctrlKey?:boolean;altKey?:boolean;metaKey?:boolean},target:{closest:(selector:string)=>unknown}|null) {
  if(event.ctrlKey||event.altKey||event.metaKey||target?.closest('input,textarea,select,[contenteditable="true"],[role="combobox"],[role="slider"]'))return null;
  if(event.key===' '&&target?.closest('button,[role="button"]'))return null;
  if(event.key===' '&&event.shiftKey)return 'previous';
  if(['ArrowRight','PageDown',' '].includes(event.key))return 'next';
  if(['ArrowLeft','PageUp'].includes(event.key))return 'previous';
  if(event.key==='Home')return 'first';
  if(event.key==='End')return 'last';
  return null;
}
export function readerSwipe(start:{x:number;y:number}|null,end:{x:number;y:number},scale:number): -1|0|1 {
  if(!start||scale>1.05)return 0;
  const dx=end.x-start.x,dy=end.y-start.y;
  return Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4?(dx<0?1:-1):0;
}
