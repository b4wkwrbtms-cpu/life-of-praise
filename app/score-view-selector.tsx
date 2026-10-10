'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw,UsersRound} from 'lucide-react';
import {requestJson} from '@/lib/api-response';
import {notesForSong,scoreViewLabel,sessionLabel,type ScoreView,type ScoreViewMember} from '@/lib/score-views';
import type {Profile,Service} from '@/lib/types';

export function useScoreView(service:Service,profile:Profile,churchId:string){
 const [user,setUser]=useState(profile.id),[attempt,setAttempt]=useState(0),[members,setMembers]=useState<ScoreViewMember[]>([{id:profile.id,name:profile.name,position:profile.position}]);
 const [result,setResult]=useState<{key:string;view:ScoreView|null;error:string}|null>(null);
 const requestKey=JSON.stringify([churchId,service.id,service.version,user,attempt]);
 const requestCounter=useRef(0);
 useEffect(()=>{let active=true;const ticket=++requestCounter.current;
  requestJson<ScoreView>(`/api/services/${encodeURIComponent(service.id)}/score-views?version=${service.version}&user=${encodeURIComponent(user)}`,{headers:{'X-Church-Id':churchId},credentials:'same-origin',cache:'no-store'}).then(view=>{
   if(!active||ticket!==requestCounter.current)return;setMembers(view.members);setResult({key:requestKey,view,error:''});
  }).catch(e=>{if(active&&ticket===requestCounter.current)setResult({key:requestKey,view:null,error:e.message})});
  return()=>{active=false};
 },[requestKey]);
 const current=result?.key===requestKey?result:null;
 return {user,setUser,members,view:current?.view||null,error:current?.error||'',loading:!current,refresh:()=>setAttempt(n=>n+1)};
}

export default function ScoreViewSelector({model,profile,disabled=false}:{model:ReturnType<typeof useScoreView>;profile:Profile;disabled?:boolean}){
 return <div className="score-view-selector"><UsersRound size={18} aria-hidden="true"/><label><span>누구의 악보를 볼까요?</span><select aria-label="악보 표시할 팀원 선택" value={model.user} disabled={disabled} onChange={e=>model.setUser(e.target.value)}>
  <option value={profile.id}>내 악보 · {sessionLabel(profile.position)} · {profile.name}</option><option value="common">공통 송폼 악보</option>
  <optgroup label="팀원 악보 · 읽기 전용">{model.members.filter(m=>m.id!==profile.id).map(m=><option value={m.id} key={m.id}>{sessionLabel(m.position)} · {m.name}</option>)}</optgroup>
 </select></label><button type="button" className="icon-button" disabled={disabled||model.loading} aria-label="연주 표시 새로 불러오기" onClick={model.refresh}><RefreshCw size={17} className={model.loading?'spin':''}/></button></div>;
}

export function ScoreViewNotice({view,service}:{view:ScoreView;service:Service}){
 const rows=service.data.songs.map(song=>({song,...notesForSong(view,song)})),missing=rows.flatMap(r=>r.missing.map(note=>({title:r.song.title,note}))),stale=rows.filter(r=>r.needsReview),count=rows.reduce((n,r)=>n+r.notes.length,0);
 return <div className="score-view-notice" role="status"><span>{scoreViewLabel(view)}{view.userId?` · 표시 ${count}개${view.own?'':' · 읽기 전용'}`:' · 개인 표시 없음'}</span>
  {stale.length>0&&<small>이전 버전 표시가 있는 {stale.length}곡은 작성자의 위치 확인이 필요합니다.</small>}
  {missing.length>0&&<details><summary>현재 악보로 옮기지 않은 메모 {missing.length}개</summary><ul>{missing.map(({title,note},i)=><li key={i}><strong>{title}</strong> · {note.text}</li>)}</ul><small>작성자가 ‘내 연주 표시’에서 현재 페이지로 옮길 수 있습니다.</small></details>}
 </div>;
}
