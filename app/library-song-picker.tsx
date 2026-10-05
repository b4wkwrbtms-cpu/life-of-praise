'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,Search,X,Plus} from 'lucide-react';
import {Dialog,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import DialogContent from './workbench-dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Checkbox} from '@/components/ui/checkbox';
import {api} from '@/lib/client';
import {formText,type Service,type Song} from '@/lib/types';
import {librarySongs,librarySongKey,type LibrarySong} from '@/lib/song-library';

export default function LibrarySongPicker({serviceId,songs,onAdd,onClose}:{serviceId:string;songs:Song[];onAdd:(items:LibrarySong[])=>void;onClose:()=>void}){
 const [services,setServices]=useState<Service[]>([]),[picked,setPicked]=useState<string[]>([]),[query,setQuery]=useState(''),[tab,setTab]=useState('complete'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const heading=useRef<HTMLHeadingElement>(null),submitting=useRef(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');api<Service[]>('services').then(items=>{if(active)setServices(items)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[attempt]);
 const entries=useMemo(()=>librarySongs(services,serviceId),[services,serviceId]);
 const existing=new Set(songs.flatMap(s=>s.librarySource?[librarySongKey(s.librarySource)]:[]));
 const selected=picked.map(id=>entries.find(item=>item.id===id)).filter((item):item is LibrarySong=>!!item&&!existing.has(item.id));
 const remaining=Math.max(0,30-songs.length);
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const visible=entries.filter(item=>item.kind===tab&&terms.every(t=>(item.song.title+' '+item.song.key+' '+item.date+' '+item.serviceTitle).toLocaleLowerCase().includes(t)));
 const toggle=(id:string)=>setPicked(ids=>ids.includes(id)?ids.filter(v=>v!==id):ids.length<remaining?[...ids,id]:ids);
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="library-song-picker" onOpenAutoFocus={e=>{e.preventDefault();heading.current?.focus({preventScroll:true})}}>
  <DialogTitle ref={heading} tabIndex={-1}>도서관에서 찬양 불러오기</DialogTitle>
  <DialogDescription>필요한 곡만 선택하세요. 악보·송폼·구간 표시를 함께 가져옵니다.</DialogDescription>
  <Tabs value={tab} onValueChange={setTab}><TabsList className="library-import-tabs"><TabsTrigger value="complete">완성본 {entries.filter(e=>e.kind==='complete').length}곡</TabsTrigger><TabsTrigger value="draft">초안 {entries.filter(e=>e.kind==='draft').length}곡</TabsTrigger></TabsList></Tabs>
  <div className="search-box library-song-search"><Search size={18}/><input aria-label="불러올 찬양 검색" placeholder="곡 이름 · Key · 사용 날짜" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" className="icon-button" aria-label="검색 지우기" onClick={()=>setQuery('')}><X size={16}/></button>}</div>
  <div className="library-import-count"><span role="status">{loading?'목록을 불러오는 중…':`${visible.length}곡 · ${selected.length}곡 선택`}</span><span>{remaining}곡 추가 가능</span></div>
  <div className="library-import-list" aria-label="불러올 찬양 목록" aria-busy={loading}>
   {loading?<p className="library-import-empty">도서관을 불러오는 중…</p>:error?<div className="error-panel" role="alert">{error}<button type="button" onClick={()=>setAttempt(v=>v+1)}>다시 시도</button></div>:visible.length?visible.map(item=>{
    const added=existing.has(item.id),checked=picked.includes(item.id),full=!checked&&selected.length>=remaining;
    const sameTitle=songs.some(s=>s.title.trim()&&s.title.trim()===item.song.title.trim()&&s.key.trim()===item.song.key.trim());
    return <label className={'library-import-card '+(checked?'selected ':'')+(added||full?'unavailable':'')} key={item.id}>
     <Checkbox aria-label={`${item.song.title||'제목 없는 찬양'} · ${item.date} · ${item.song.key||'Key 미지정'} 선택`} checked={checked} disabled={added||full} onCheckedChange={()=>toggle(item.id)}/>
     <div className="library-import-info"><div className="library-import-title"><strong>{item.song.title||'제목 없는 찬양'}</strong>{item.song.key&&<span className="key-badge">{item.song.key}</span>}</div><small>{item.date} · {item.serviceTitle}{item.kind==='complete'?` · v${item.version}`:' · 초안'}</small><p>{formText(item.song)||'송폼 미지정'}</p><span>악보 {item.song.pages.length}페이지{item.song.bpm?` · ${item.song.bpm} BPM`:''}{added?' · 이미 불러온 곡':sameTitle?' · 같은 제목·Key가 선곡에 있어요':''}</span></div>
     {checked&&<span className="library-pick-order" aria-label={`추가 순서 ${picked.indexOf(item.id)+1}`}>{picked.indexOf(item.id)+1}</span>}
    </label>;
   }):<div className="library-import-empty"><BookOpen size={28}/><strong>{query?'검색 결과가 없습니다.':tab==='complete'?'불러올 완성 찬양이 없습니다.':'불러올 초안 찬양이 없습니다.'}</strong><span>{query?'다른 곡 이름이나 날짜로 검색해 주세요.':'현재 편집 중인 예배와 휴지통은 제외됩니다.'}</span></div>}
  </div>
  {selected.length>0&&<div className="library-picked" aria-label="선택한 찬양 순서">{selected.map((item,i)=><button type="button" key={item.id} onClick={()=>toggle(item.id)} aria-label={`${i+1}. ${item.song.title} 선택 해제`}><span>{i+1}. {item.song.title||'제목 없는 찬양'}</span><X size={14}/></button>)}</div>}
  <div className="library-import-footer"><small>선택한 순서로 현재 선곡 뒤에 추가됩니다.<br/>편집해도 도서관 원본은 그대로 유지됩니다.</small><div><button type="button" className="secondary" onClick={onClose}>취소</button><button type="button" className="primary" disabled={!selected.length||loading||!!error||selected.length>remaining} onClick={()=>{if(submitting.current)return;submitting.current=true;try{onAdd(selected)}finally{submitting.current=false}}}><Plus size={17}/>{selected.length}곡 불러오기</button></div></div>
 </DialogContent></Dialog>;
}
