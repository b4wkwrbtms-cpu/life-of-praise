'use client';
import {useRef,useState} from 'react';
import {Copy,Check,Share2} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {copyText} from '@/lib/client';
import {weekShareText,type Service} from '@/lib/types';
import {toast} from 'sonner';
export default function ShareWeek({service,onClose}:{service:Service;onClose:()=>void}){
 const ref=useRef<HTMLTextAreaElement>(null),d=service.data;
 const [scripture,setScripture]=useState(true),[form,setForm]=useState(true),[notice,setNotice]=useState(true),[links,setLinks]=useState(true),[copied,setCopied]=useState(false);
 const text=weekShareText(d,{scripture,form,notice,links});
 const copy=async()=>{try{await copyText(text);setCopied(true);toast.success('복사했습니다. 카톡에 붙여넣어 주세요.')}catch{ref.current?.focus();ref.current?.select();ref.current?.setSelectionRange(0,text.length);toast.info('내용을 선택했습니다. 길게 눌러 복사해 주세요.')}};
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="share-week-dialog"><DialogTitle>카톡에 공유할 내용</DialogTitle><DialogDescription>곡에 등록한 유튜브·음원 링크도 함께 복사합니다. 포함할 내용을 골라 주세요.</DialogDescription><div className="share-options">{[{label:'본문 전문',value:scripture,set:setScripture},{label:'곡별 송폼',value:form,set:setForm},{label:'유튜브 · 음원 링크',value:links,set:setLinks},{label:'연습 · 공지',value:notice,set:setNotice}].map(o=><label key={o.label}><Switch checked={o.value} onCheckedChange={v=>{o.set(v);setCopied(false)}}/>{o.label}</label>)}</div><textarea ref={ref} className="share-week-text" aria-label="주간 말씀과 찬양 복사 내용" readOnly value={text}/><div className="row spread"><small className="subtle">{text.length.toLocaleString()}자 · {d.songs.length}곡</small><button className="text-button" onClick={()=>{ref.current?.focus();ref.current?.select();ref.current?.setSelectionRange(0,text.length)}}>전체 선택</button></div><button className="primary full" onClick={copy}>{copied?<Check size={18}/>:<Copy size={18}/>} {copied?'복사 완료 · 다시 복사':'전체 내용 복사'}</button></DialogContent></Dialog>
}
