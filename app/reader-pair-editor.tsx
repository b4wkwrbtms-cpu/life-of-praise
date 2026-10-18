'use client';
import {useState} from 'react';
import {ArrowLeftRight,Check,Plus,Trash2} from 'lucide-react';
import {fileUrl} from '@/lib/client';
import {readerPageKey,readerPageRef,type ReaderPair,type ReaderPageRef} from '@/lib/reader-pairs';
import type {ReaderPage} from '@/lib/reader-layout';

export default function ReaderPairEditor({pages,initialPairs,initialPage,saving,error,removed,onSave,onCancel,onReload}:{pages:ReaderPage[];initialPairs:ReaderPair[];initialPage?:ReaderPageRef;saving:boolean;error:string;removed:number;onSave:(pairs:ReaderPair[],focus?:ReaderPageRef)=>void;onCancel:()=>void;onReload:()=>void}){
 const [pairs,setPairs]=useState(initialPairs);
 const [selected,setSelected]=useState<ReaderPageRef[]>(()=>initialPage&&!initialPairs.some(pair=>pair.some(ref=>readerPageKey(ref)===readerPageKey(initialPage)))?[initialPage]:[]);
 const [query,setQuery]=useState('');
 const selectedKeys=selected.map(readerPageKey),used=new Map(pairs.flatMap((pair,n)=>pair.map(ref=>[readerPageKey(ref),n+1] as const)));
 const describe=(ref:ReaderPageRef)=>{const item=pages.find(page=>readerPageKey(readerPageRef(page))===readerPageKey(ref));return item?`${item.song.title} · ${item.pi+1}페이지`:'이전 악보'};
 const add=()=>{if(selected.length===2){setPairs(previous=>[...previous,selected as ReaderPair]);setSelected([])}};
 const save=()=>onSave(selected.length===2?[...pairs,selected as ReaderPair]:pairs,selected[0]||pairs.at(-1)?.[0]);
 return <section className="reader-pair-editor" aria-label="내 두 장 보기 설정" aria-busy={saving}>
  <div className="reader-pair-scroll">
   <div className="reader-pair-intro"><span className="eyebrow">MY SCORE PAIRS</span><h3>함께 볼 두 장 선택</h3><p>같은 곡이나 다른 곡의 페이지를 두 장씩 골라 주세요. 묶지 않은 악보는 한 장씩 표시됩니다.</p><small>내 계정에 저장 · 패드와 노트북에서 함께 사용</small></div>
   {removed>0&&<p className="reader-pair-notice" role="status">악보가 바뀐 묶음 {removed}개를 해제했습니다. 현재 악보로 다시 선택해 주세요.</p>}
   {pairs.length>0&&<section className="reader-saved-pairs" aria-label="저장할 두 장 묶음"><h4>내 묶음 <span>{pairs.length}</span></h4>{pairs.map((pair,n)=><div className="reader-saved-pair" key={pair.map(readerPageKey).join('|')}><span className="reader-pair-number">{String(n+1).padStart(2,'0')}</span><div><span><small>왼쪽</small>{describe(pair[0])}</span><span><small>오른쪽</small>{describe(pair[1])}</span></div><button className="icon-button" aria-label={`${n+1}번 묶음 좌우 바꾸기`} disabled={saving} onClick={()=>setPairs(pairs.map((current,i)=>i===n?[current[1],current[0]]:current))}><ArrowLeftRight size={17}/></button><button className="icon-button" aria-label={`${n+1}번 묶음 해제`} disabled={saving} onClick={()=>setPairs(pairs.filter((_,i)=>i!==n))}><Trash2 size={17}/></button></div>)}</section>}
   <div className="reader-pair-search"><h4>이번 예배 악보 <span>{pages.length}장</span></h4><input aria-label="두 장으로 볼 곡 검색" placeholder="곡 이름 검색" value={query} onChange={event=>setQuery(event.target.value)}/></div>
   <div className="reader-page-choices">{pages.filter(page=>page.song.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map((item,index)=>{
    const ref=readerPageRef(item),key=readerPageKey(ref),chosen=selectedKeys.indexOf(key),pair=used.get(key);
    return <button type="button" key={key} className={'reader-page-choice'+(chosen>=0?' selected':'')} aria-pressed={chosen>=0} aria-label={`${item.song.title} ${item.pi+1}페이지${pair?` · 묶음 ${pair}`:''}`} disabled={saving||!!pair||(selected.length===2&&chosen<0)} onClick={()=>setSelected(chosen>=0?selected.filter((_,i)=>i!==chosen):[...selected,ref])}>
     <div className="reader-choice-image"><img src={fileUrl(item.page.id)} alt="" loading={index<4?'eager':'lazy'} decoding="async"/><span>{chosen>=0?<><Check size={14}/>{chosen===0?'왼쪽':'오른쪽'}</>:pair?`묶음 ${pair}`:`${item.pi+1}페이지`}</span></div><strong>{item.song.title}</strong><small>{String(item.si+1).padStart(2,'0')}번째 곡 · {item.pi+1}/{item.song.pages.length}페이지</small>
    </button>;
   })}</div>
   {!pages.some(page=>page.song.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))&&<p className="reader-pair-empty">검색한 곡이 없습니다.</p>}
  </div>
  <footer className="reader-pair-actions">
   {error&&<div className="reader-pair-error" role="alert"><p>{error}</p><button className="text-button" disabled={saving} onClick={onReload}>저장된 설정 다시 불러오기</button></div>}
   <div className="reader-pair-selection"><span role="status">{selected.length===1?'함께 볼 두 번째 악보를 선택해 주세요.':selected.length===2?'왼쪽·오른쪽 악보를 선택했습니다.':`${pairs.length}개 묶음 · 나머지는 한 장씩`}</span>{selected.length>0&&<button className="text-button" disabled={saving} onClick={()=>setSelected([])}>선택 해제</button>}{selected.length===2&&<button className="secondary compact" disabled={saving} onClick={add}><Plus size={15}/>묶음 추가</button>}</div>
   <div className="reader-pair-save-row"><button className="secondary" disabled={saving} onClick={onCancel}>취소</button><button className="primary" disabled={saving||selected.length===1} onClick={save}>{saving?'저장 중…':'저장하고 보기'}</button></div>
  </footer>
 </section>;
}
