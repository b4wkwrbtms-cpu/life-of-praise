'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Maximize,Minimize,X,LoaderCircle,PanelsTopLeft} from 'lucide-react';
import {Dialog,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import DialogContent from './workbench-dialog';
import {toast} from 'sonner';
import type {Service,Profile} from '@/lib/types';
import ScoreViewSelector,{useScoreView,ScoreViewNotice} from './score-view-selector';
import {notesForPage,scoreViewLabel,type ScoreView} from '@/lib/score-views';
import {readerPages,readerIndex,readerLayout,readerColumns,readerWindow,readerStep,readerLast,readerKeyAction,readerSwipe,type ReaderLayout,type ReaderFit,type ReaderPage} from '@/lib/reader-layout';
import {readerFullscreenElement,requestReaderFullscreen,exitReaderFullscreen} from '@/lib/reader-fullscreen';
import ScorePreview from './score-preview';
import {fileUrl} from '@/lib/client';
import {readerPageKey,readerPageRef,personalReaderSpreads,personalReaderFrame,type ReaderPair,type ReaderPageRef} from '@/lib/reader-pairs';
import {useReaderPairs} from './use-reader-pairs';
import ReaderPairEditor from './reader-pair-editor';

function ReaderSheet({item,view,service}:{item:ReaderPage;view:ScoreView;service:Service}) {
 const [failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
 const notes=notesForPage(view,item.song,item.page.id),file=item.song.exports[item.pi];
 const exported=file&&!item.song.renderOnRead&&!notes.length&&!failed;
 return <figure className="reader-sheet">
  <div className="reader-sheet-viewport">
   {exported?<><img src={fileUrl(file)} draggable={false} alt={`${item.song.title} ${item.pi+1}페이지 · ${scoreViewLabel(view)}`} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>{!loaded&&<div className="reader-loading" role="status"><LoaderCircle className="spin" size={20}/>악보 불러오는 중…</div>}</>:<ScorePreview page={item.page} song={item.song} notes={notes} meta={`${service.date} · ${item.song.title} · v${service.version} · ${scoreViewLabel(view)}`}/>}
  </div>
  <figcaption><span>{String(item.si+1).padStart(2,'0')} · {item.song.title}</span><span>{item.pi+1}/{item.song.pages.length}</span></figcaption>
 </figure>;
}

export default function RehearsalReader({service,profile,churchId,startSongId,startPageId,configurePairs=false,onClose}:{service:Service;profile:Profile;churchId:string;startSongId?:string;startPageId?:string;configurePairs?:boolean;onClose:()=>void}) {
 const views=useScoreView(service,profile,churchId),view=views.view;
 const pages=readerPages(service);
 const pairs=useReaderPairs(service.id,service.version,churchId,profile.id);
 const memoryKey=`praise-reader:${churchId}:${profile.id}:${service.id}:v${service.version}`;
 const layoutKey=`praise-reader-layout:${churchId}:${profile.id}`;
 const [index,setIndex]=useState(()=>{
  if(startSongId)return readerIndex(pages.findIndex(p=>p.song.id===startSongId&&(!startPageId||p.page.id===startPageId)),pages.length);
  try{return readerIndex(sessionStorage.getItem(memoryKey),pages.length)}catch{return 0}
 });
 const [layout,setLayout]=useState<ReaderLayout>(()=>{try{return readerLayout(localStorage.getItem(layoutKey))}catch{return 'auto'}});
 const [fit,setFit]=useState<ReaderFit>('page'),[presenting,setPresenting]=useState(false);
 const [size,setSize]=useState({width:0,height:0});
 const [pairEditing,setPairEditing]=useState(configurePairs),[pairSeed,setPairSeed]=useState<ReaderPageRef|undefined>(()=>pages[index]?readerPageRef(pages[index]):undefined);
 const root=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
 const touch=useRef<{x:number;y:number}|null>(null),nativeActive=useRef(false),escapeGuard=useRef(0),presentationRef=useRef(false),active=useRef(true),previousFit=useRef<ReaderFit>('page');
 const columns=readerColumns(layout,size.width,size.height),windowPages=readerWindow(index,pages.length,columns);
 const customSpreads=personalReaderSpreads(pages,pairs.data?.pairs||[]);
 const frame=layout==='custom'?personalReaderFrame(index,customSpreads):{indices:Array.from({length:windowPages.end-windowPages.start},(_,i)=>windowPages.start+i),start:windowPages.start,previousIndex:windowPages.previous?readerStep(index,pages.length,columns,-1):null,nextIndex:windowPages.next?readerStep(index,pages.length,columns,1):null,lastIndex:readerLast(pages.length,columns),label:windowPages.label};
 const visible=frame.indices.map(i=>pages[i]),item=visible[0],next=pages[frame.nextIndex??-1];
 const pageLabel=`${frame.label} / ${pages.length}장`;
 const go=(direction:-1|1)=>setIndex(i=>{if(layout!=='custom')return readerStep(i,pages.length,columns,direction);const current=personalReaderFrame(i,customSpreads);return (direction===1?current.nextIndex:current.previousIndex)??i});
 const openPairEditor=()=>{setPairSeed(item?readerPageRef(item):undefined);setPairEditing(true)};
 const savePairs=async(selected:ReaderPair[],focus?:ReaderPageRef)=>{
  const saved=await pairs.save(selected);if(!saved)return;
  const first=focus||selected.at(-1)?.[0];
  if(first)setIndex(readerIndex(pages.findIndex(page=>readerPageKey(readerPageRef(page))===readerPageKey(first)),pages.length));
  setLayout('custom');setPairEditing(false);toast.success('내 두 장 보기 설정을 저장했습니다.');
 };
 const exitPresentation=()=>{
  presentationRef.current=false;setPresenting(false);setFit(previousFit.current);
  void exitReaderFullscreen(root.current);
 };
 const enterPresentation=()=>{
  previousFit.current=fit;presentationRef.current=true;setPresenting(true);setFit('page');
  // Keep this request in the click handler; browsers require a user gesture.
  void requestReaderFullscreen(root.current).then(ok=>{
   if(!active.current)return;
   if(!presentationRef.current){void exitReaderFullscreen(root.current);return}
   if(!ok)toast.info('앱 안의 발표 화면으로 전환했습니다. 전체화면을 지원하는 브라우저에서는 화면 전체로 열립니다.');
  });
  stage.current?.focus({preventScroll:true});
 };
 const close=()=>{if(pairs.busy)return;presentationRef.current=false;void exitReaderFullscreen(root.current);onClose()};

 useEffect(()=>{
  const node=stage.current;if(!node)return;
  const measure=()=>{const rect=node.getBoundingClientRect();setSize(old=>old.width===rect.width&&old.height===rect.height?old:{width:rect.width,height:rect.height})};
  measure();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;observer?.observe(node);
  window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure)};
 },[pairEditing]);
 useEffect(()=>{stage.current?.scrollTo(0,0);try{sessionStorage.setItem(memoryKey,String(frame.start))}catch{}},[frame.start,memoryKey]);
 useEffect(()=>{try{localStorage.setItem(layoutKey,layout)}catch{}},[layoutKey,layout]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(pairEditing)return;
   const action=readerKeyAction(event,event.target instanceof Element?event.target:null);
   if(!action)return;event.preventDefault();
   if(action==='first')setIndex(0);
   else if(action==='last')setIndex(frame.lastIndex);
   else go(action==='next'?1:-1);
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[pages.length,columns,layout,pairs.data,pairEditing,frame.lastIndex]);
 useEffect(()=>{
  const element=root.current;active.current=true;
  const changed=()=>{
   const owned=!!element&&readerFullscreenElement(document)===element;
   if(owned&&!presentationRef.current){void exitReaderFullscreen(element);return}
   if(nativeActive.current&&!owned){
    escapeGuard.current=Date.now()+300;presentationRef.current=false;setPresenting(false);setFit(previousFit.current);
   }
   nativeActive.current=owned;
  };
  document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
  return()=>{active.current=false;document.removeEventListener('fullscreenchange',changed);document.removeEventListener('webkitfullscreenchange',changed);void exitReaderFullscreen(element)};
 },[]);
 useEffect(()=>{
  let lock:any;let live=true;
  const acquire=async()=>{try{if(document.visibilityState==='visible'&&(!lock||lock.released)){const wake=await (navigator as any).wakeLock?.request('screen');if(live)lock=wake;else wake?.release();}}catch{}};
  void acquire();document.addEventListener('visibilitychange',acquire);
  return()=>{live=false;lock?.release();document.removeEventListener('visibilitychange',acquire)};
 },[]);
 useEffect(()=>{
  const indices=frame.nextIndex===null?[]:layout==='custom'?personalReaderFrame(frame.nextIndex,customSpreads).indices:Array.from({length:Math.min(columns,pages.length-frame.nextIndex)},(_,i)=>frame.nextIndex!+i);
  for(const i of indices){
   const nextPage=pages[i],file=nextPage.song.exports[nextPage.pi];
   if(file&&!nextPage.song.renderOnRead){const image=new Image();image.src=fileUrl(file)}
  }
 },[frame.nextIndex,columns,service,layout,pairs.data]);

 return <Dialog open onOpenChange={open=>!open&&close()}>
  <DialogContent ref={root} fitVisualViewport className={'rehearsal-reader reader-spread-mode'+(presenting?' reader-presenting':'')} showCloseButton={false} onEscapeKeyDown={event=>{
   if(pairEditing||pairs.busy){event.preventDefault();if(!pairs.busy)setPairEditing(false)}
   else if(presentationRef.current){event.preventDefault();escapeGuard.current=Date.now()+300;exitPresentation()}
   else if(Date.now()<escapeGuard.current)event.preventDefault();
  }}>
   <header className={'reader-header'+(presenting?' sr-only':'')}>
    <div className="reader-heading"><DialogTitle>{item?item.song.title:'전체 악보'} {item?.song.key&&<span className="key-badge">{item.song.key}</span>}</DialogTitle><DialogDescription>{service.date} · {service.title} · 합주 모드</DialogDescription></div>
    {!presenting&&!pairEditing&&<div className="reader-controls">
     <label><span className="sr-only">한 화면에 볼 악보 수</span><select aria-label="한 화면에 볼 악보 수" value={layout} onChange={event=>{const choice=readerLayout(event.target.value);setLayout(choice);if(choice==='custom'&&!pairs.data?.pairs.length)openPairEditor()}}><option value="auto">자동 · {columns===2?'두 장':'한 장'}</option><option value="single">한 장 보기</option><option value="double">두 장 나란히</option><option value="custom">내 두 장 묶음</option></select></label>
     <label><span className="sr-only">악보 보기 크기</span><select aria-label="악보 보기 크기" value={fit} onChange={event=>setFit(event.target.value as ReaderFit)}><option value="page">화면 맞춤</option><option value="width">너비 맞춤</option><option value="zoom">150% 확대</option></select></label>
     <button className="primary reader-present-button" disabled={!pages.length} onClick={enterPresentation}><Maximize size={18}/><span>발표 시작</span></button>
     <button className="icon-button" aria-label="합주 모드 닫기" onClick={close}><X size={22}/></button>
    </div>}
    {pairEditing&&<button className="secondary compact" disabled={pairs.busy} onClick={()=>setPairEditing(false)}>악보로 돌아가기</button>}
   </header>
   {!presenting&&!pairEditing&&<div className="reader-view-panel"><div className="reader-view-actions"><ScoreViewSelector model={views} profile={profile}/><button className={'reader-pair-entry'+(layout==='custom'?' active':'')} onClick={openPairEditor} disabled={pages.length<2}><PanelsTopLeft size={17}/><span>함께 볼 두 장 선택{pairs.data?.pairs.length?` · ${pairs.data.pairs.length}묶음`:''}</span></button></div>{view&&<ScoreViewNotice view={view} service={service}/>}</div>}
   {pairEditing?<>{pairs.data?<ReaderPairEditor key={`${churchId}:${profile.id}:${service.id}:${service.version}:${pairs.data.revision}`} pages={pages} initialPairs={pairs.data.pairs} initialPage={pairSeed} saving={pairs.busy} error={pairs.error} removed={pairs.data.removed} onCancel={()=>setPairEditing(false)} onReload={pairs.refresh} onSave={savePairs}/>:<div className="reader-pair-wait" role={pairs.error?'alert':'status'}>{pairs.error?<><p>{pairs.error}</p><button className="secondary" onClick={pairs.refresh}>다시 불러오기</button></>:<><LoaderCircle className="spin" size={22}/>내 설정을 불러오는 중…</>}</div>}</>:<div ref={stage} className={'reader-stage reader-fit-'+fit} tabIndex={0} aria-label="전체 악보. 방향키로 이전 또는 다음 악보로 이동" onTouchStart={event=>{
    touch.current=event.touches.length===1&&fit==='page'?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
   }} onTouchMove={event=>{if(event.touches.length!==1)touch.current=null}} onTouchEnd={event=>{
    const start=touch.current;touch.current=null;
    if(event.touches.length||!event.changedTouches[0])return;
    const end=event.changedTouches[0],direction=readerSwipe(start,{x:end.clientX,y:end.clientY},window.visualViewport?.scale||1);
    if(direction)go(direction);
   }} onTouchCancel={()=>{touch.current=null}}>
    {layout==='custom'&&!pairs.data?<div className="reader-pair-wait" role={pairs.error?'alert':'status'}>{pairs.error?<><p>{pairs.error}</p><button className="secondary" onClick={pairs.refresh}>설정 다시 불러오기</button></>:<><LoaderCircle className="spin" size={22}/>내 두 장 묶음을 불러오는 중…</>}</div>:views.loading?<div className="reader-loading" role="status"><LoaderCircle className="spin" size={22}/>연주 표시를 불러오는 중…</div>:views.error?<div className="reader-view-error" role="alert"><strong>연주 표시를 불러오지 못했습니다</strong><p>{views.error}</p><button className="secondary" onClick={views.refresh}>다시 불러오기</button></div>:item&&view?<div className="reader-spread" data-pages={visible.length} style={{gridTemplateColumns:`repeat(${visible.length}, minmax(0, 1fr))`}}>
     {visible.map(page=><ReaderSheet key={`${view.userId||'common'}:${service.version}:${page.song.id}:${page.page.id}:${page.song.exports[page.pi]||''}`} item={page} view={view} service={service}/>)}
    </div>:<p>등록된 악보가 없습니다.</p>}
   </div>}
   {!pairEditing&&(presenting?<footer className="reader-presentation-bar">
    <button className="icon-button" disabled={frame.previousIndex===null} aria-label="이전 악보" onClick={()=>go(-1)}><ChevronLeft/></button>
    <div className="reader-presentation-position"><strong aria-live="polite">{pageLabel}</strong><small>{view?scoreViewLabel(view):'악보 불러오는 중'}</small></div>
    <button className="icon-button" disabled={frame.nextIndex===null} aria-label="다음 악보" onClick={()=>go(1)}><ChevronRight/></button>
    <button className="secondary reader-exit-presentation" onClick={exitPresentation}><Minimize size={17}/><span>발표 종료</span></button>
   </footer>:<footer className="reader-footer">
    <button className="secondary" disabled={frame.previousIndex===null} onClick={()=>go(-1)} aria-label="이전 악보"><ChevronLeft/><span>이전</span></button>
    <div className="reader-position"><strong aria-live="polite">{pageLabel}</strong><select aria-label="곡 바로 이동" value={item?.song.id||''} onChange={event=>setIndex(readerIndex(pages.findIndex(page=>page.song.id===event.target.value),pages.length))}>{service.data.songs.map((song,i)=>song.pages.length?<option key={song.id} value={song.id}>{i+1}. {song.title}</option>:null)}</select><small className="reader-next">{next?`다음: ${next.song.title} · ${next.pi+1}페이지`:'마지막 악보입니다.'}<span className="reader-key-hint"> · ← → / 스페이스바</span></small></div>
    <button className="primary" disabled={frame.nextIndex===null} onClick={()=>go(1)} aria-label="다음 악보"><span>다음</span><ChevronRight/></button>
   </footer>)}
  </DialogContent>
 </Dialog>;
}
