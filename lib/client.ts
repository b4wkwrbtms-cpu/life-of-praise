import type {Song,ScorePage,Note,SectionMarker} from './types';
import {readApiResponse} from './api-response';
let activeChurch='';
export function setChurchContext(id:string){if(activeChurch!==id){activeChurch=id;imageCache.clear();}}
function churchHeaders():Record<string,string>{return activeChurch?{'X-Church-Id':activeChurch}:{};}
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{const res=await fetch('/api/'+path,{method,headers:{...churchHeaders(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});return readApiResponse<T>(res);}
export async function upload(file:File,kind='raw'){const f=new FormData();f.append('file',file);const r=await fetch('/api/files?kind='+kind,{method:'POST',headers:churchHeaders(),body:f});const data=await readApiResponse<{id:string}>(r);return data.id;}
export function fileUrl(id:string){return '/api/files/'+encodeURIComponent(id)+(activeChurch?'?church='+encodeURIComponent(activeChurch):'');}
export const imageCache=new Map<string,Promise<HTMLImageElement>>();
export function loadImage(id:string){let promise=imageCache.get(id);if(!promise){promise=new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{imageCache.delete(id);reject(new Error('악보 이미지를 불러오지 못했습니다.'));};im.src=id.startsWith('blob:')?id:fileUrl(id);});imageCache.set(id,promise);while(imageCache.size>12)imageCache.delete(imageCache.keys().next().value!);}return promise;}
export async function preparePages(files:File[],progress:(s:string)=>void):Promise<ScorePage[]>{const pages:ScorePage[]=[];for(const file of files){if(file.size>20*1024*1024)throw new Error('파일은 20MB 이하로 올려 주세요.');if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){progress('PDF를 펼치는 중…');const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';const task=pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/',wasmUrl:'/pdf-wasm/'});const pdf=await task.promise;if(pdf.numPages>30){await task.destroy();throw new Error('PDF는 파일당 30페이지까지 지원합니다.');}const source=await upload(file);for(let i=1;i<=pdf.numPages;i++){progress(`PDF ${i}/${pdf.numPages} 페이지 저장 중…`);const page=await pdf.getPage(i),v=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1800/v.width,2800/v.height,3)}),c=document.createElement('canvas');c.width=Math.round(viewport.width);c.height=Math.round(viewport.height);await page.render({canvas:c,viewport}).promise;const b=await toBlob(c);const id=await upload(new File([b],`${file.name}-p${i}.png`,{type:'image/png'}));pages.push({id,width:c.width,height:c.height,source} as ScorePage);c.width=0;c.height=0;page.cleanup();}await task.destroy();}else{if(!['image/png','image/jpeg'].includes(file.type))throw new Error('JPG·PNG·PDF를 선택해 주세요. HEIC는 JPG로 변환해 주세요.');progress(file.name+' 저장 중…');const u=URL.createObjectURL(file);try{const im=await loadImage(u);const id=await upload(file);pages.push({id,width:im.naturalWidth,height:im.naturalHeight});}finally{URL.revokeObjectURL(u);imageCache.delete(u);}}}return pages;}
export function toBlob(c:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('이미지를 생성하지 못했습니다.')),'image/png'));}
function wrap(ctx:CanvasRenderingContext2D,text:string,max:number){const words=text.split(' '),lines:string[]=[];let line='';for(const w of words){const next=line?line+' '+w:w;if(ctx.measureText(next).width>max&&line){lines.push(line);line=w;}else line=next;while(ctx.measureText(line).width>max&&line.length>1){let cut=line.length-1;while(cut>1&&ctx.measureText(line.slice(0,cut)).width>max)cut--;lines.push(line.slice(0,cut));line=line.slice(cut);}}if(line)lines.push(line);return lines;}
export type Box={id:string;x:number;y:number;w:number;h:number};
export type Geometry={width:number;height:number;rawWidth:number;rawHeight:number;offset:number;offsetX:number;noteBoxes:Box[];markerBoxes:Box[];formBox?:Box;overflow:boolean};
export function sectionMarkerText(type:SectionMarker['type']){return type==='V'?'Verse':type==='C'?'Chorus':type;}
export async function renderScore(canvas:HTMLCanvasElement,page:ScorePage,song:Song,notes:Note[]=[],meta=''):Promise<Geometry>{
 const im=await loadImage(page.id);await document.fonts.ready;
 const rawWidth=Math.min(1800,page.width),rawHeight=Math.round(rawWidth*page.height/page.width),layout=page.layout??song.layout,size=Math.max(14,rawWidth*layout.size);
 const markers=(song.markers||[]).filter(m=>m.pageId===page.id);
 const inline=layout.markerStyle==='inline';
 const offsetX=!inline&&markers.length&&layout.leftMargin!==false?Math.max(100,Math.ceil(rawWidth*.13)):0,width=rawWidth+offsetX;
 const probe=document.createElement('canvas').getContext('2d')!;probe.font=`600 ${size}px Arial, sans-serif`;
 const form=song.form.map(s=>s.type).join(' - '),available=Math.min(layout.width,1-layout.x)*rawWidth,lines=wrap(probe,form,available),lineHeight=size*1.45;
 const offset=layout.margin?Math.max(100,Math.ceil(lines.length*lineHeight+size*2)):0;
 if(rawHeight+offset+54>16384||width*(rawHeight+offset+54)>16000000)throw new Error('송폼과 여백이 너무 큽니다. 송폼 너비를 넓히거나 크기를 줄여 주세요.');
 canvas.width=width;canvas.height=rawHeight+offset+54;
 const c=canvas.getContext('2d')!;c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(im,offsetX,offset,rawWidth,rawHeight);
 c.font=`600 ${size}px Arial, sans-serif`;c.fillStyle='#263c30';c.textBaseline='top';
 const fx=offsetX+layout.x*rawWidth,fy=layout.margin?size:layout.y*rawHeight;
 if(lines.length){const pad=size*.25,bx=Math.max(offsetX,fx-pad),by=Math.max(0,fy-pad),textWidth=Math.max(...lines.map(line=>c.measureText(line).width));c.fillStyle='#ffffff';c.fillRect(bx,by,Math.min(width-bx,textWidth+pad+fx-bx),lines.length*lineHeight+pad+fy-by);c.fillStyle='#263c30';}
 for(let i=0;i<lines.length;i++)c.fillText(lines[i],fx,fy+i*lineHeight);
 const markerBoxes:Box[]=[];
 for(const m of markers){
  const text=sectionMarkerText(m.type),maxWidth=offsetX?offsetX-16:rawWidth*.14;
  let ms=Math.max(14,m.size*rawWidth);c.font=`700 ${ms}px Arial, sans-serif`;
  const pad=inline?.35:.7;const measured=c.measureText(text).width+ms*pad;if(!inline&&measured>maxWidth){ms*=maxWidth/measured;c.font=`700 ${ms}px Arial, sans-serif`;}
  const w=inline?Math.max(...['Intro','Verse','V1','V2','PC','Chorus','Inter','Bridge','Outro'].map(t=>c.measureText(t).width))+ms*.5:c.measureText(text).width+ms*pad,h=ms*(inline?1.25:1.65),x=inline?Math.max(1,Math.min((m.x??.02)*rawWidth,rawWidth-w-1)):offsetX?(offsetX-w)/2:rawWidth*.012,y=offset+Math.max(1,Math.min(m.y*rawHeight,rawHeight-h-1));
  if(inline){c.fillStyle='#fff';c.fillRect(x,y,w,h);c.strokeStyle='#202020';c.lineWidth=Math.max(1,rawWidth*.001);c.strokeRect(x,y,w,h);c.fillStyle='#111';c.textBaseline='alphabetic';const metrics=c.measureText('Mg');const ascent=metrics.actualBoundingBoxAscent,descent=metrics.actualBoundingBoxDescent;c.fillText(text,x+(w-c.measureText(text).width)/2,y+(h+ascent-descent)/2);c.textBaseline='top';}
  else{c.fillStyle='#edf3eb';c.fillRect(x,y,w,h);c.fillStyle='#315d48';c.fillRect(x,y,Math.max(2,rawWidth*.002),h);c.fillText(text,x+ms*.35,y+ms*.28);}
  markerBoxes.push({id:m.id,x,y,w,h});
 }
 const noteBoxes:Box[]=[];
 for(const n of notes.filter(n=>n.pageId===page.id)){
  const ns=Math.max(14,n.size*rawWidth),x=offsetX+n.x*rawWidth,y=n.y*rawHeight+offset;c.font=`700 ${ns}px Arial, sans-serif`;
  const noteLines=wrap(c,n.text,rawWidth*.88),nw=Math.min(rawWidth,Math.max(...noteLines.map(t=>c.measureText(t).width),0)+ns*.6),nh=ns*1.5*noteLines.length;
  const nx=Math.max(offsetX,Math.min(x,width-nw)),ny=Math.max(offset,Math.min(y,rawHeight+offset-nh));
  c.fillStyle='#ffffffed';c.fillRect(nx,ny,nw,nh);c.fillStyle=n.color;noteLines.forEach((line,i)=>c.fillText(line,nx+ns*.3,ny+ns*.18+i*ns*1.5));noteBoxes.push({id:n.id,x:nx,y:ny,w:nw,h:nh});
 }
 c.fillStyle='#6b756f';c.font='18px Arial, sans-serif';c.fillText(meta.slice(0,145),24,rawHeight+offset+17);
 const overflow=fx+Math.max(0,...lines.map(line=>probe.measureText(line).width))>width+1||(!layout.margin&&fy+lines.length*lineHeight>rawHeight);
 return {width,height:canvas.height,rawWidth,rawHeight,offset,offsetX,noteBoxes,markerBoxes,formBox:lines.length?{id:'form',x:fx,y:fy,w:Math.max(...lines.map(line=>probe.measureText(line).width)),h:lines.length*lineHeight}:undefined,overflow};
}
export async function saveImage(blob:Blob,name:string){const file=new File([blob],name,{type:'image/png'});if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return;}catch(e){if((e as Error).name==='AbortError')return;}}const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}
export async function copyText(text:string){if(navigator.clipboard){await navigator.clipboard.writeText(text);return;}throw new Error('자동 복사가 지원되지 않습니다. 표시된 링크를 길게 눌러 복사해 주세요.');}
