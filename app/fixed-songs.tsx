'use client';
import {useEffect,useState,useRef,useId} from 'react';
import {Bookmark,Search,Trash2,Check,Plus} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {api} from '@/lib/client';
import {formText,cloneFixedSongs,type FixedSong,type Song} from '@/lib/types';
import {toast} from 'sonner';

export function FixedSongList({existing=[],remaining=30,onAdd,onChoose}:{existing?:string[];remaining?:number;onAdd?:(songs:Song[])=>void;onChoose?:()=>void}){
 const choiceId=useId();
 const [items,setItems]=useState<FixedSong[]>([]),[picked,setPicked]=useState<string[]>([]),[q,setQ]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[remove,setRemove]=useState<FixedSong|null>(null),[busy,setBusy]=useState(false);
 const reload=async()=>{setLoading(true);setError('');try{setItems(await api('fixed-songs'))}catch(e){setError((e as Error).message)}finally{setLoading(false)}};
 useEffect(()=>{reload()},[]);
 const list=items.filter(f=>(f.title+' '+f.data.key).toLowerCase().includes(q.trim().toLowerCase()));
 const available=list.filter(f=>!existing.includes(f.id)),all=available.length>0&&available.every(f=>picked.includes(f.id));
 return <div className="fixed-library">
  <div className="fixed-library-intro"><Bookmark size={22}/><p>자주 쓰는 찬양을 여러 곡 보관하세요.<br/><span>자동으로 추가하지 않습니다. 필요한 곡만 골라 독립된 사본으로 불러옵니다.</span></p></div>
  <div className="search-box"><Search size={18}/><input aria-label="고정찬양 검색" placeholder="고정찬양 이름 · Key 검색" value={q} onChange={e=>setQ(e.target.value)}/></div>
  {onAdd&&<div className="row spread fixed-selection-heading"><button type="button" className="text-button" disabled={loading||!available.length} onClick={()=>setPicked(all?picked.filter(id=>!available.some(f=>f.id===id)):[...new Set([...picked,...available.map(f=>f.id)])].slice(0,remaining))}>{all?'선택 해제':'보이는 곡 전체 선택'}</button><span>{picked.length}곡 선택 · 최대 {remaining}곡 추가</span></div>}
  <div className="fixed-song-list">
   {loading?<p role="status">고정찬양을 불러오는 중…</p>:error?<div className="error-panel" role="alert">{error}<button className="secondary" onClick={reload}>다시 시도</button></div>:list.map(f=>{
    const added=existing.includes(f.id),checked=picked.includes(f.id);
    return <section className={'fixed-song-card '+(checked?'selected':'')} key={f.id}>
     {onAdd&&<input type="checkbox" id={choiceId+f.id} aria-label={f.title+' 불러오기 선택'} checked={checked} disabled={added||(!checked&&picked.length>=remaining)} onChange={e=>setPicked(ids=>e.target.checked?[...ids,f.id]:ids.filter(id=>id!==f.id))}/>}
     <div className="fixed-song-info"><h3>{onAdd?<label htmlFor={choiceId+f.id}>{f.title||'제목 없는 찬양'} {f.data.key&&<span className="key-badge">{f.data.key}</span>}</label>:<>{f.title||'제목 없는 찬양'} {f.data.key&&<span className="key-badge">{f.data.key}</span>}</>}</h3><p>{formText(f.data)||'송폼 미지정'}</p><small>악보 {f.data.pages.length}페이지{added?' · 이 예배에 추가됨':''}</small></div>
     {!onAdd&&<button className="icon-button danger" aria-label={f.title+' 고정 목록에서 삭제'} disabled={busy} onClick={()=>setRemove(f)}><Trash2 size={18}/></button>}
    </section>;
   })}
   {!loading&&!error&&!list.length&&<div className="fixed-empty"><Bookmark size={30}/><strong>{q?'검색 결과가 없습니다.':'아직 고정찬양이 없습니다.'}</strong><p>예배 편집의 ‘곡 · 송폼 설정’에서<br/>‘새 고정찬양으로 저장’을 눌러 추가하세요.</p>{onChoose&&<button className="secondary" onClick={onChoose}>기존 예배 열기</button>}</div>}
  </div>
  {onAdd&&<div className="fixed-import-footer"><span>기존 찬양 뒤에 선택한 순서로 추가됩니다.</span><button type="button" className="primary" disabled={!picked.length||loading||picked.length>remaining} onClick={()=>onAdd(cloneFixedSongs(picked.map(id=>items.find(f=>f.id===id)!).filter(Boolean)))}><Plus size={18}/>{picked.length||''}곡 불러오기</button></div>}
  {!onAdd&&!loading&&items.length>0&&<p className="fixed-footnote"><Check size={16}/>예배 편집 → 고정찬양 불러오기에서 여러 곡을 선택할 수 있습니다.</p>}
  <AlertDialog open={!!remove} onOpenChange={v=>!v&&!busy&&setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>고정찬양에서 제거할까요?</AlertDialogTitle><AlertDialogDescription>‘{remove?.title}’을 보관함에서 제거합니다. 이미 만든 예배와 악보는 그대로 유지됩니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>취소</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={async e=>{e.preventDefault();if(!remove||busy)return;setBusy(true);try{await api('fixed-songs/'+remove.id,'DELETE',{revision:remove.revision});setRemove(null);await reload();toast.success('고정 목록에서 제거했습니다.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{busy?'처리 중…':'목록에서 제거'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </div>;
}
export default function FixedSongs({onChoose}:{onChoose:()=>void}){return <><div className="page-heading"><div><span className="eyebrow">SAVED PRAISE</span><h1>고정찬양 보관함</h1><p>반복하는 찬양을 모아두고, 필요할 때 불러오세요.</p></div></div><FixedSongList onChoose={onChoose}/></>}
export function FixedSongPicker({songs,onAdd,onClose}:{songs:Song[];onAdd:(songs:Song[])=>void;onClose:()=>void}){const heading=useRef<HTMLHeadingElement>(null);return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="fixed-picker-dialog" onOpenAutoFocus={e=>{e.preventDefault();heading.current?.focus({preventScroll:true})}}><DialogTitle tabIndex={-1} ref={heading}>고정찬양 불러오기</DialogTitle><DialogDescription>여러 곡을 선택해 현재 편집 중인 예배에 추가합니다.</DialogDescription><FixedSongList existing={songs.map(s=>s.fixedId).filter((id):id is string=>!!id)} remaining={Math.max(0,30-songs.length)} onAdd={onAdd}/></DialogContent></Dialog>}
