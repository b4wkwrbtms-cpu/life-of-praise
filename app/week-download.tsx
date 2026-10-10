'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Download,FileArchive,LoaderCircle,RotateCcw,Share2,X} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import type {Service,Profile} from '@/lib/types';
import type {DownloadProgress,ScoreBundle} from '@/lib/week-download';
import {fileUrl,renderScore,toBlob} from '@/lib/client';
import ScoreViewSelector,{useScoreView,ScoreViewNotice} from './score-view-selector';
import {notesForPage,scoreViewLabel,type ScoreView} from '@/lib/score-views';
import {toast} from 'sonner';

export default function WeekDownload({service,profile,churchId,onClose}:{service:Service;profile:Profile;churchId:string;onClose:()=>void}){
 const views=useScoreView(service,profile,churchId),view=views.view;
 const [prepared,setBundle]=useState<(ScoreBundle&{view:ScoreView})|null>(null),[url,setUrl]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[progress,setProgress]=useState<DownloadProgress>({done:0,total:service.data.songs.reduce((n,s)=>n+s.pages.length,0),title:'악보 목록을 확인하고 있어요'}),[sharing,setSharing]=useState(false),[canShare,setCanShare]=useState(false);
 const bundle=prepared?.view===view?prepared:null;
 const controller=useRef<AbortController|null>(null),shareLock=useRef(false);
 useEffect(()=>{
  const control=new AbortController();controller.current=control;let alive=true,objectUrl='';
  setBundle(null);setUrl('');setError('');setCanShare(false);
  setProgress({done:0,total:service.data.songs.reduce((n,s)=>n+s.pages.length,0),title:'선택한 연주 표시를 확인하고 있어요'});
  if(!view)return()=>{alive=false;control.abort()};
  (async()=>{
   try{
    const {createScoreBundle,fetchScoreFile,weekDownloadEntries}=await import('@/lib/week-download');
    if(control.signal.aborted)return;
    const urls=new Map(weekDownloadEntries(service).map(entry=>[entry.exportId,fileUrl(entry.exportId)]));
    const result=await createScoreBundle(service,async(entry,signal)=>{
     const song=service.data.songs[entry.songNumber-1],page=song.pages[entry.pageNumber-1],notes=notesForPage(view,song,page.id);
     if(!notes.length&&entry.exportId)return fetchScoreFile(urls.get(entry.exportId)!,signal);
     const canvas=document.createElement('canvas');
     try{await renderScore(canvas,page,song,notes,`${service.date} · ${song.title} · v${service.version} · ${scoreViewLabel(view)} · ${entry.pageNumber}/${song.pages.length}`);return await toBlob(canvas)}finally{canvas.width=0;canvas.height=0}
    },{signal:control.signal,cacheByPage:!!view.userId,viewLabel:scoreViewLabel(view),onProgress:p=>{if(alive)setProgress(p)}});
    if(!alive)return;objectUrl=URL.createObjectURL(result.blob);setBundle({...result,view});setUrl(objectUrl);
    try{setCanShare(!!navigator.canShare?.({files:result.files}))}catch{setCanShare(false)}
   }catch(e){if(alive&&!control.signal.aborted)setError((e as Error).message)}
  })();
  return()=>{alive=false;control.abort();if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[service,view,attempt]);
 const close=()=>{if(shareLock.current)return;controller.current?.abort();onClose()};
 const share=async()=>{if(!bundle||shareLock.current)return;shareLock.current=true;setSharing(true);try{await navigator.share({files:bundle.files,title:service.date+' · '+service.title+' 전체 악보'})}catch(e){if((e as Error).name!=='AbortError')toast.error('이 기기에서 여러 이미지 공유를 열지 못했습니다. ZIP 다운로드를 이용해 주세요.')}finally{shareLock.current=false;setSharing(false)}};
 return <Dialog open onOpenChange={v=>!v&&close()}><DialogContent className="week-download-dialog" showCloseButton={false} onPointerDownOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(sharing)e.preventDefault()}}>
  <div className="week-download-heading"><span className="week-download-icon"><FileArchive size={24}/></span><div><DialogTitle>악보 전체 다운로드</DialogTitle><DialogDescription>{service.date} · {service.title} · 공개 v{service.version}</DialogDescription></div><button type="button" className="icon-button" aria-label="전체 다운로드 창 닫기" disabled={sharing} onClick={close}><X size={21}/></button></div>
  <ScoreViewSelector model={views} profile={profile} disabled={sharing}/>
  <p className="week-download-note">공통 송폼·구간 표시와 선택한 사람의 저장된 연주 표시를 함께 담습니다.</p>
  {view&&<ScoreViewNotice view={view} service={service}/>}
  {error||views.error?<div className="week-download-error" role="alert"><strong>악보 준비를 완료하지 못했습니다</strong><p>{error||views.error}</p><button type="button" className="secondary" onClick={()=>views.error?views.refresh():setAttempt(a=>a+1)}><RotateCcw size={16}/>다시 준비하기</button></div>:bundle&&view?<div className="week-download-ready" role="status"><Check size={21}/><div><strong>{bundle.songCount}곡 · 악보 {bundle.pageCount}장 준비 완료</strong><p>{scoreViewLabel(view)} · 곡과 페이지 순서대로 담았습니다.</p></div></div>:<div className="week-download-progress" role="status" aria-live="polite"><div className="row spread"><strong><LoaderCircle size={17} className="spin"/>{views.loading?'연주 표시를 불러오고 있어요':'악보를 모으고 있어요'}</strong><span>{progress.done} / {progress.total}장</span></div><progress aria-label="전체 악보 준비 진행률" max={Math.max(1,progress.total)} value={progress.done}/><p>{progress.title}</p></div>}
  <ol className="week-download-list" aria-label="다운로드할 곡 순서">{service.data.songs.map((song,i)=><li key={song.id}><span>{String(i+1).padStart(2,'0')}</span><strong>{song.title||'제목 없는 찬양'}</strong><small>{song.pages.length}장</small></li>)}</ol>
  {bundle&&url&&view?<div className="week-download-actions"><a className="primary full" href={url} download={bundle.name}><Download size={18}/><span>전체 악보 ZIP 다운로드</span><small>{(bundle.blob.size/1024/1024).toFixed(1)}MB</small></a>{canShare&&<button type="button" className="secondary full" disabled={sharing} onClick={share}><Share2 size={18}/>{sharing?'저장·공유 메뉴 열림…':'이미지 한 번에 저장·공유'}</button>}<small>ZIP 파일을 열면 곡별 악보 이미지가 나옵니다. 아이폰은 ‘파일’ 앱에서 ZIP을 눌러 풀 수 있습니다.</small></div>:<button type="button" className="secondary full" onClick={close}>{error||views.error?'닫기':'준비 취소'}</button>}
 </DialogContent></Dialog>;
}
