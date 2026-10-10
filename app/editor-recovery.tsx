'use client';
import {CloudOff,RefreshCw,ShieldCheck} from 'lucide-react';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter} from '@/components/ui/alert-dialog';
import {sameDraft,type DraftBackup,type DraftSaveState} from '@/lib/draft-recovery';
import type {Worship} from '@/lib/types';

export function EditorSaveNotice({state,storageIssue,busy,onRetry,onLeave,onCopy}:{state:DraftSaveState;storageIssue:boolean;busy:boolean;onRetry:()=>void;onLeave:()=>void;onCopy:()=>void}){
 const conflict=state.phase==='conflict',failed=['error','offline','conflict'].includes(state.phase);
 if(!failed&&!storageIssue)return null;
 return <aside className="editor-save-notice" role="status">
  <div>{state.backup?<ShieldCheck size={18}/>:<CloudOff size={18}/>}<p><strong>{conflict?'다른 창에서 편집한 내용이 있습니다':failed?(state.backup?'현재 편집은 이 기기에 보관되어 있습니다':'서버에 저장하지 못했습니다'):'이 기기에서 자동 복구 보관을 사용할 수 없습니다'}</strong><span>{conflict?'기존 내용을 덮어쓰지 않고 별도 초안으로 보관할 수 있어요.':failed?state.error:'창을 닫기 전 ‘서버에 저장됨’을 확인해 주세요.'}</span></p></div>
  <div className="editor-save-actions">{failed&&(conflict?<button type="button" className="secondary compact" disabled={busy} onClick={onCopy}>별도 초안으로 보관</button>:<button type="button" className="secondary compact" disabled={busy} onClick={onRetry}><RefreshCw size={15}/>저장 재시도</button>)}{failed&&state.backup&&<button type="button" className="text-button" disabled={busy} onClick={onLeave}>기기에 보관하고 닫기</button>}</div>
 </aside>;
}

export function EditorRecoveryDialog({backup,current,count,busy,onRestore,onDiscard,onClose}:{backup:DraftBackup;current:Worship;count:number;busy:boolean;onRestore:()=>void;onDiscard:()=>void;onClose:()=>void}){
 const changed=!sameDraft(backup.base,current);
 return <AlertDialog open><AlertDialogContent className="editor-recovery-dialog"><AlertDialogHeader><span className="eyebrow">CONTINUE YOUR WORSHIP</span><AlertDialogTitle>이전 편집을 이어서 할까요?</AlertDialogTitle><AlertDialogDescription>이 기기에 서버 저장을 마치지 못한 편집이 있습니다.{count>1?` 보관된 편집 ${count}개 중 가장 최근 내용입니다.`:''} 다른 창에서 편집 중이라면 먼저 그 창의 저장 상태를 확인해 주세요.</AlertDialogDescription></AlertDialogHeader>
  <div className="editor-recovery-summary"><ShieldCheck size={23}/><div><strong>{backup.data.title||'이름 없는 예배'}</strong><span>{backup.data.date||'날짜 미정'} · 찬양 {backup.data.songs.length}곡 · 악보 {backup.data.songs.reduce((n,s)=>n+s.pages.length,0)}장</span><small>{new Date(backup.updated).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} 보관</small></div></div>
  <p className="editor-recovery-explanation">{changed?'그동안 서버 내용이 바뀌었습니다. 복구하면 별도 예배 초안인 ‘복구본’을 만들어 기존 편집을 보존합니다.':'복구하면 현재 예배 초안에서 편집을 이어갑니다. 팀에 공개하기 전에는 팀원 악보가 바뀌지 않습니다.'}</p>
  <AlertDialogFooter><button type="button" className="text-button" disabled={busy} onClick={onClose}>나중에</button><button type="button" className="secondary" disabled={busy} onClick={onDiscard}>이 기기 편집 버리기</button><button type="button" className="primary" disabled={busy} onClick={onRestore}>{busy?'복구 중…':changed?'별도 초안으로 복구':'복구해서 계속'}</button></AlertDialogFooter>
 </AlertDialogContent></AlertDialog>;
}
