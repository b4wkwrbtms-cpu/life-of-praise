'use client';
import {ArrowUpRight,Download,MessageCircle,Play} from 'lucide-react';

export default function WeeklyActions({onRead,onShare,onDownload}:{onRead:()=>void;onShare:()=>void;onDownload:()=>void}){
 return <nav className="weekly-actions" aria-label="이번 주 악보 바로가기">
  <button type="button" className="weekly-action weekly-action-main" onClick={onRead}>
   <span className="weekly-action-icon"><Play size={22} aria-hidden="true"/></span>
   <span><strong>전체 악보로 합주하기</strong><small>내 표시 · 팀원 악보도 함께</small></span>
   <ArrowUpRight size={21} aria-hidden="true"/>
  </button>
  <button type="button" className="weekly-action" onClick={onShare}>
   <span className="weekly-action-icon"><MessageCircle size={20} aria-hidden="true"/></span>
   <span><strong>카톡 공유</strong><small>말씀 · 송폼 · 음원 링크</small></span>
  </button>
  <button type="button" className="weekly-action" onClick={onDownload}>
   <span className="weekly-action-icon"><Download size={20} aria-hidden="true"/></span>
   <span><strong>악보 전체 저장</strong><small>이번 주 악보 한 번에</small></span>
  </button>
 </nav>;
}
