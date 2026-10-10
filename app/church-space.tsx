'use client';
import {useEffect,useState} from 'react';
import {Building2,Users,ShieldCheck,Copy,RefreshCw} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {api,setChurchContext,copyText} from '@/lib/client';
import {POSITIONS,type Church,type Profile,type ChurchApplication} from '@/lib/types';
import {Field,Mark,Picker} from './ui';
import {toast} from 'sonner';
import {entryReturnPath,signOutPath,type Entry} from '@/lib/entry';
const TEAM_POSITIONS=POSITIONS.filter(p=>p!=='인도자').map(p=>({value:p,label:p}));

export function LeaderApplication({me,done,initialCode=''}:{me:any;done:()=>void;initialCode?:string}){
 const [name,setName]=useState(me?.account?.name||me?.name||''),[churchName,setChurch]=useState(''),[code,setCode]=useState(initialCode),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const applications:ChurchApplication[]=me?.applications||[],pending=applications.find(a=>a.status==='pending');
 const open=async(id:string)=>{setBusy(true);try{await api('churches/select','POST',{id});setChurchContext(id);done()}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}};
 return <div className="leader-application"><p className="church-role-note"><ShieldCheck size={20}/><span>총관리자에게 받은 인도자 초대 코드로 신청하세요. 인도자와 새 교회가 함께 승인되면 공간이 열립니다.</span></p>
 {applications.map(a=><article className="application-result" key={a.id}><div className="row spread"><strong>{a.church_name}</strong><span className={'pill '+(a.status==='pending'?'amber':'')}>{a.status==='pending'?'승인 대기':a.status==='approved'?'승인 완료':'승인 거절'}</span></div>{a.status==='pending'?<p>총관리자가 신청을 확인하고 있습니다. 승인 전에는 교회 개설·팀원 초대가 제한됩니다.</p>:a.status==='rejected'?<p>{a.reason}<br/>다시 신청하려면 새 초대 코드를 받아 주세요.</p>:<button className="secondary" disabled={busy} onClick={()=>open(a.church_id!)}>승인된 교회 열기</button>}</article>)}
 {!pending&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setFormError('');try{await api('church-applications','POST',{name,churchName,leaderCode:code});setCode('');setChurch('');history.replaceState(null,'',location.pathname);toast.success('인도자·교회 개설 신청을 보냈습니다.');done()}catch(e){setFormError((e as Error).message)}finally{setBusy(false)}}}>
 {formError&&<p className="error-text" role="alert">{formError}</p>}<Field label="인도자 이름"><input required value={name} onChange={e=>setName(e.target.value)} maxLength={40} autoComplete="name"/></Field><Field label="개설할 교회 찬양팀 이름"><input required minLength={2} maxLength={80} value={churchName} onChange={e=>setChurch(e.target.value)} placeholder="예: ○○교회 찬양팀"/></Field><Field label="총관리자가 발급한 인도자 초대 코드"><input required value={code} onChange={e=>setCode(e.target.value.trim())} maxLength={100} autoCapitalize="none" autoCorrect="off" placeholder="팀원 초대 코드와 다릅니다"/></Field><button className="primary full" disabled={busy||!name.trim()||churchName.trim().length<2||!code}>{busy?'신청 중…':'인도자·교회 개설 승인 요청'}</button></form>}
 <button className="text-button" disabled={busy} onClick={done}><RefreshCw size={16}/>승인 상태 새로고침</button></div>;
}

function TeamJoin({me,done,initialCode=''}:{me:any;done:()=>void;initialCode?:string}){
 const [name,setName]=useState(me?.account?.name||me?.name||''),[position,setPosition]=useState('싱어'),[invite,setInvite]=useState(initialCode),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 return <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setFormError('');try{const r=await api('me','POST',{name,position,invite});setChurchContext(r.churchId);history.replaceState(null,'',location.pathname);done()}catch(e){setFormError((e as Error).message)}finally{setBusy(false)}}}>
 {formError&&<p className="error-text" role="alert">{formError}</p>}<Field label="이름"><input required value={name} onChange={e=>setName(e.target.value)} maxLength={40} autoComplete="name"/></Field><Field label="담당 세션 / 역할"><Picker value={position} onChange={setPosition} label="팀원 역할" options={TEAM_POSITIONS}/></Field>{!me?.owner&&<Field label="교회 팀원 초대 코드"><input required value={invite} onChange={e=>setInvite(e.target.value.trim())} maxLength={100} autoCapitalize="none" autoCorrect="off" placeholder="교회 인도자에게 받은 코드"/></Field>}<p className="subtle">이 코드를 발급한 교회의 팀원으로 참여합니다.</p><button className="primary full" disabled={busy||!name.trim()}>{busy?'참여 중…':'우리 교회 팀원으로 참여'}</button></form>;
}

export function ChurchSetup({me,error,done,entry={role:'team',code:'',issue:''}}:{me:any;error:string;done:()=>void;entry?:Entry}){
 const [mode,setMode]=useState((entry.code?entry.role==='leader':entry.role==='leader'||me?.applications?.some((a:ChurchApplication)=>a.status==='pending'))?'leader':'join'),[busy,setBusy]=useState(false);
 return <main className="setup-wrap"><section className="setup-card panel church-setup"><Mark/><h1>우리 교회 찬양팀</h1><p>초대 코드의 종류에 맞게 참여해 주세요.</p>
 {me?.email&&<div className="setup-account"><span>로그인한 계정<strong>{me.email}</strong></span><a href={signOutPath(entryReturnPath(entry))} target="_top" className="text-button">계정 변경</a></div>}
 {error&&<p className="error-text" role="alert">{error}</p>}{entry.issue?<div className="error-text" role="alert"><p>{entry.issue}</p><a href="/" className="text-button">초대 정보 다시 확인하기</a></div>:me?.blocked?<p className="error-text">계정 접근이 중지되었습니다. 총관리자에게 문의해 주세요.</p>:<>
 {me?.churches?.length>0&&<div className="church-existing"><strong>참여 중인 교회</strong>{me.churches.map((c:Church)=><button type="button" className="secondary full" key={c.id} disabled={!c.active&&!me.superAdmin||busy} onClick={async()=>{setBusy(true);try{await api('churches/select','POST',{id:c.id});setChurchContext(c.id);done()}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{c.name}{!c.active?' · 운영 중지':''}</button>)}</div>}
 {entry.code?<div className="entry-invitation"><ShieldCheck size={18}/><span>{entry.role==='leader'?'인도자 가입 신청':'찬양팀으로 참여'} · 초대 코드가 입력되었습니다.</span></div>:<Tabs value={mode} onValueChange={setMode}><TabsList className="church-mode-tabs"><TabsTrigger value="join">팀원으로 참여</TabsTrigger><TabsTrigger value="leader">인도자 가입 신청</TabsTrigger></TabsList></Tabs>}
 {mode==='join'?<TeamJoin me={me} initialCode={entry.role==='team'?entry.code:''} done={done}/>:<LeaderApplication me={me} initialCode={entry.role==='leader'?entry.code:''} done={done}/>}
 {entry.code&&<a className="text-button" href="/">다른 초대 코드로 참여하기</a>}
 </>}</section></main>;
}

export function ChurchManager({me,onSwitch,reload}:{me:any;onSwitch:(id:string)=>Promise<void>;reload:()=>Promise<void>}){
 const [mode,setMode]=useState('list'),[busy,setBusy]=useState(false);
 return <section className="panel church-manager"><h2><Building2 size={21}/>내 교회 공간</h2><div className="church-manager-actions"><button className="secondary" onClick={()=>setMode(mode==='join'?'list':'join')}>팀원 초대 코드로 참여</button><button className="text-button" onClick={()=>setMode(mode==='leader'?'list':'leader')}>인도자·새 교회 신청</button></div>{mode==='join'&&<TeamJoin me={me} done={()=>{setMode('list');reload()}}/>}{mode==='leader'&&<LeaderApplication me={me} done={reload}/>}
 <div className="church-list">{(me.churches||[]).map((c:Church)=><article key={c.id} className={c.id===me.church.id?'selected':''}><div><strong>{c.name}</strong><small>{!c.active?'운영 중지':c.role==='admin'?'인도자':'팀원'}</small></div><button className="secondary compact" disabled={busy||!c.active||c.id===me.church.id} onClick={async()=>{setBusy(true);try{await onSwitch(c.id)}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>{c.id===me.church.id?'현재 교회':'열기'}</button></article>)}</div></section>;
}

export function ChurchTeam({profile,church,reload}:{profile:Profile;church:Church;reload:()=>Promise<void>}){
 const [members,setMembers]=useState<(Profile&{devices?:{platform:string;installedAt:number|null;launchedAt:number|null}[]})[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[invite,setInvite]=useState(''),[name,setName]=useState(church.name);
 const refresh=async()=>{try{setMembers(await api('team'));setError('')}catch(e){setError((e as Error).message)}};
 useEffect(()=>{setName(church.name);setInvite('');refresh()},[church.id]);
 const update=async(id:string,patch:any)=>{if(busy)return;setBusy(true);try{await api('team','PATCH',{id,...patch});await refresh();await reload()}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}};
 return <section className="panel church-team"><h2><Users size={20}/>우리 교회 찬양팀</h2><Field label="교회 찬양팀 이름"><input value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></Field><button className="secondary" disabled={busy||name.trim().length<2||name===church.name} onClick={async()=>{setBusy(true);try{await api('churches/'+church.id,'PATCH',{name});await reload();toast.success('교회 이름을 저장했습니다.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}>교회 이름 저장</button><button className="secondary" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await api('invite','POST');const url=location.origin+'/?invite='+r.code;setInvite(url);await copyText(url);toast.success('교회 팀원 초대 링크를 복사했습니다.')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}}><Copy size={16}/>우리 교회 팀원 초대</button>{invite&&<textarea className="invite-url" readOnly value={invite} aria-label="교회 팀원 초대 링크"/>}<p className="subtle">이 교회의 팀원 가입 전용입니다. 인도자 권한이나 새 교회 개설 권한은 부여하지 않습니다. 새 링크를 만들면 이전 링크는 만료됩니다.</p>{error&&<div className="error-panel">{error}<button onClick={refresh}>다시 시도</button></div>}
 <div className="team-install-summary"><strong>앱 실행 확인 {members.filter(m=>m.active&&m.devices?.some(d=>d.launchedAt)).length} / {members.filter(m=>m.active).length}명</strong><button className="text-button" disabled={busy} onClick={refresh}>상태 새로고침</button></div><p className="subtle">홈 화면의 앱으로 로그인하면 실행을 확인합니다. 미확인은 미설치를 뜻하지 않으며, 삭제 여부는 자동 확인할 수 없습니다.</p>
 <div className="church-member-list">{members.map(m=><article key={m.id}><div><strong>{m.name}</strong><small>{m.role==='admin'?'인도자':m.position+' · 팀원'}{!m.active?' · 접근 중지':''}</small><div className="member-install-status">{!m.devices?.length?<span className="install-badge">설치 미확인</span>:m.devices.map(d=><div key={d.platform}><span className={'install-badge '+(d.launchedAt?'confirmed':'')}>{d.platform==='ios'?'아이폰·아이패드':d.platform==='android'?'안드로이드':'컴퓨터'} · {d.launchedAt?'앱 실행 확인':'설치 확인 · 실행 대기'}</span><small>마지막 확인 {new Date(d.launchedAt||d.installedAt!).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div>)}</div></div>{m.id!==profile.id&&(profile.superAdmin||m.role!=='admin')&&<div>{m.role==='admin'&&profile.superAdmin&&<button className="text-button" disabled={busy} onClick={()=>update(m.id,{role:'member'})}>팀원으로 변경</button>}<button className="text-button" disabled={busy} onClick={()=>update(m.id,{active:!m.active})}>{m.active?'접근 중지':'다시 허용'}</button></div>}</article>)}</div></section>;
}
