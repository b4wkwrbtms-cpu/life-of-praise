'use client';
import {FileMusic,ListMusic} from 'lucide-react';
export default function EditorPaneNav({pane,onChange,disabled=false}:{pane:string;onChange:(pane:string)=>void;disabled?:boolean}){
 return <nav className="editor-pane-nav" aria-label="곡 설정과 악보 편집 전환">
  <button type="button" aria-pressed={pane==='details'} disabled={disabled} onClick={()=>onChange('details')}><ListMusic size={18}/><span>곡 · 송폼 설정</span></button>
  <button type="button" aria-pressed={pane==='score'} disabled={disabled} onClick={()=>onChange('score')}><FileMusic size={18}/><span>악보 · 구간 표시</span></button>
 </nav>;
}
