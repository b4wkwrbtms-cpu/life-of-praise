'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,FileMusic,ListMusic,LoaderCircle,Redo2,Save,Undo2,X} from 'lucide-react';
import {Dialog,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import DialogContent from './workbench-dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {requestJson} from '@/lib/api-response';
import {renderScore} from '@/lib/client';
import {sameSongForm,songFormPatch} from '@/lib/song-form';
import type {Service,Song} from '@/lib/types';
import {toast} from 'sonner';
import SongFormBuilder from './song-form-builder';
import SectionMarkerEditor from './section-marker-editor';

export default function SongFormEditor({serviceId,songId,churchId,onClose,onSaved}:{serviceId:string;songId:string;churchId:string;onClose:()=>void;onSaved:(service:Service)=>void}){
 const [base,setBase]=useState<Service|null>(null),[song,setSong]=useState<Song|null>(null),[pane,setPane]=useState('details'),[page,setPage]=useState(0),[busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[conflict,setConflict]=useState(false),[attempt,setAttempt]=useState(0),[discard,setDiscard]=useState<'close'|'reload'|null>(null);
 const [undo,setUndo]=useState<Song[]>([]),[redo,setRedo]=useState<Song[]>([]),lock=useRef(false);
 const route=`/api/services/${encodeURIComponent(serviceId)}/songs/${encodeURIComponent(songId)}/form`;
 const original=base?.data.songs.find(s=>s.id===songId),dirty=!!(original&&song&&!sameSongForm(original,song));
 useEffect(()=>{let active=true;setLoading(true);setError('');setConflict(false);
  requestJson<Service>(route,{headers:{'X-Church-Id':churchId},cache:'no-store',credentials:'same-origin'}).then(data=>{if(!active)return;const selected=data.data.songs.find(s=>s.id===songId);if(!selected)throw new Error('찬양을 찾을 수 없습니다.');setBase(data);setSong(structuredClone(selected));setUndo([]);setRedo([]);setPage(0);setLoading(false)}).catch(e=>{if(active){setError(e.message);setLoading(false)}});
  return()=>{active=false};
 },[route,churchId,attempt]);
 useEffect(()=>{if(!dirty)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave)},[dirty]);
 const change=(patch:Partial<Song>)=>{if(!song||lock.current)return;setUndo(u=>[...u.slice(-29),song]);setRedo([]);setSong({...song,...patch})};
 const restore=(direction:'undo'|'redo')=>{if(!song||lock.current)return;const from=direction==='undo'?undo:redo;if(!from.length)return;const next=from.at(-1)!;if(direction==='undo'){setUndo(from.slice(0,-1));setRedo(r=>[...r,song])}else{setRedo(from.slice(0,-1));setUndo(u=>[...u,song])}setSong(next)};
 const close=()=>{if(lock.current)return;if(dirty)setDiscard('close');else onClose()};
 async function save(){if(!song||!base||lock.current||!dirty)return;if(!song.form.length){setError('송폼을 한 구간 이상 입력해 주세요.');return;}lock.current=true;setError('');setConflict(false);
  try{
   for(let i=0;i<song.pages.length;i++){setBusy(`${i+1}/${song.pages.length}페이지 확인 중…`);const c=document.createElement('canvas');try{const geometry=await renderScore(c,song.pages[i],song);if(geometry.overflow){setPage(i);setPane('score');throw new Error(`${i+1}페이지의 송폼이 악보를 벗어납니다. 위치나 너비를 조절해 주세요.`)}}finally{c.width=0;c.height=0}}
   setBusy('팀 악보에 반영 중…');const updated=await requestJson<Service>(route,{method:'PATCH',headers:{'X-Church-Id':churchId,'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({version:base.version,revision:base.revision,patch:songFormPatch(song)})});
   toast.success('송폼을 팀 악보에 반영했습니다. 개인 메모는 유지됩니다.');onSaved(updated);
  }catch(e){setError((e as Error).message);setConflict((e as {status?:number}).status===409)}finally{lock.current=false;setBusy('')}
 }
 return <Dialog open onOpenChange={v=>!v&&close()}><DialogContent fitVisualViewport className="editor-dialog song-form-dialog" showCloseButton={false} onPointerDownOutside={e=>e.preventDefault()}>
  <header className="song-form-header"><div><DialogTitle>송폼 수정</DialogTitle><DialogDescription>{song?.title||'찬양 불러오기'}{base?` · 팀 공통 v${base.version}`:''}</DialogDescription></div><button className="primary compact" disabled={loading||!!busy||!dirty} onClick={save}>{busy?<LoaderCircle size={17} className="spin"/>:<Save size={17}/>}팀에 반영</button><button className="icon-button" disabled={!!busy} aria-label="송폼 편집 닫기" onClick={close}><X size={21}/></button></header>
  <nav className="song-form-pane-nav" aria-label="송폼 순서와 악보 편집 전환"><button type="button" aria-pressed={pane==='details'} onClick={()=>setPane('details')}><ListMusic size={18}/>송폼 순서</button><button type="button" aria-pressed={pane==='score'} onClick={()=>setPane('score')}><FileMusic size={18}/>악보 · 구간 표시</button></nav>
  {busy&&<div className="song-form-progress" role="status">{busy}</div>}
  {error&&<div className="song-form-error" role="alert"><span>{error}</span>{loading?null:!base?<button className="secondary compact" onClick={()=>setAttempt(a=>a+1)}>다시 불러오기</button>:conflict?<button className="secondary compact" onClick={()=>setDiscard('reload')}>최신 악보 다시 열기</button>:null}</div>}
  {loading?<div className="song-form-loading" role="status"><LoaderCircle size={22} className="spin"/>최신 송폼을 불러오는 중…</div>:song?<fieldset className="song-form-body" data-pane={pane} disabled={!!busy} inert={!!busy}>
   <section className="song-form-fields"><p className="song-form-help">저장하면 같은 교회 팀원의 공통 악보에 반영됩니다. 개인 연주 메모는 그대로 유지됩니다.</p><SongFormBuilder song={song} onChange={change}/></section>
   <section className="song-form-score"><div className="song-form-page-controls"><span>{song.title}</span><div className="page-controls"><button aria-label="이전 페이지" disabled={page===0} onClick={()=>setPage(i=>i-1)}><ChevronLeft size={18}/></button><small>{page+1} / {song.pages.length}</small><button aria-label="다음 페이지" disabled={page>=song.pages.length-1} onClick={()=>setPage(i=>i+1)}><ChevronRight size={18}/></button></div></div><SectionMarkerEditor page={song.pages[page]} song={song} onChange={change} disabled={!!busy} activePane={pane} meta={`${base?.date} · ${song.title} · 송폼 편집 미리보기`}/></section>
  </fieldset>:null}
  <footer className="song-form-footer"><span role="status">{dirty?'아직 반영하지 않은 수정':'현재 팀 송폼'}</span><button type="button" className="text-button" disabled={!undo.length||!!busy} onClick={()=>restore('undo')}><Undo2 size={17}/>되돌리기</button><button type="button" className="text-button" disabled={!redo.length||!!busy} onClick={()=>restore('redo')}><Redo2 size={17}/>다시 실행</button></footer>
  <AlertDialog open={!!discard} onOpenChange={open=>!open&&setDiscard(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{discard==='reload'?'최신 팀 악보를 다시 열까요?':'수정한 송폼을 닫을까요?'}</AlertDialogTitle><AlertDialogDescription>아직 팀에 반영하지 않은 송폼 수정은 사라집니다. 편집을 계속하려면 취소를 눌러 주세요.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>편집 계속</AlertDialogCancel><AlertDialogAction onClick={()=>{const action=discard;setDiscard(null);if(action==='reload')setAttempt(a=>a+1);else onClose()}}>{discard==='reload'?'최신 악보 열기':'수정 취소하고 닫기'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </DialogContent></Dialog>;
}
