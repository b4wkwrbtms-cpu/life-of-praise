'use client';
import {useRef} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {copyText} from '@/lib/client';
import {formText,type Service} from '@/lib/types';
import {toast} from 'sonner';
export default function ShareWeek({service,onClose}:{service:Service;onClose:()=>void}){const ref=useRef<HTMLTextAreaElement>(null),d=service.data;const text=[`[${d.date} ${d.title}]`,'',`📖 이번 주 말씀 | ${d.passage}${d.translation?' ('+d.translation+')':''}`,d.scripture,'','🎵 찬양 순서',...d.songs.map((s,i)=>`${i+1}. ${s.title}${s.key?' · '+s.key+' Key':''}\n송폼: ${formText(s)}`),...(d.rehearsal?['',`연습 안내: ${d.rehearsal}`]:[]),...(d.notice?['',`공지: ${d.notice}`]:[])].join('\n');return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent><DialogTitle>카톡에 공유할 내용</DialogTitle><DialogDescription>말씀·찬양 제목·송폼을 한 번에 복사해서 카카오톡에 붙여넣으세요.</DialogDescription><textarea ref={ref} className="share-week-text" aria-label="주간 말씀과 찬양 복사 내용" readOnly value={text}/><button className="primary" onClick={async()=>{try{await copyText(text);toast.success('복사했습니다. 카톡에 붙여넣어 주세요.')}catch{ref.current?.focus();ref.current?.select();toast.info('내용을 선택했습니다. 길게 눌러 복사해 주세요.')}}}>전체 내용 복사</button></DialogContent></Dialog>}
