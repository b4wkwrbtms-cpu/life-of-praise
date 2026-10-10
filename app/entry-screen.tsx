'use client';
import {useState} from 'react';
import {ArrowRight,Check,Copy,Music2,ShieldCheck,Users,RefreshCw} from 'lucide-react';
import {entryReturnPath,signInPath,type Entry} from '@/lib/entry';
import {copyText} from '@/lib/client';
import {Mark} from './ui';

export default function EntryScreen({entry}:{entry:Entry}){
 const [role,setRole]=useState(entry.role),[code,setCode]=useState(entry.code),[copyStatus,setCopyStatus]=useState('');
 const leader=role==='leader',invited=!!entry.code,returnTo=entryReturnPath({role,code});
 const steps=leader?['초대 코드로 인도자 신청','총관리자의 교회·인도자 승인','악보 준비와 찬양팀 초대']:['이름과 담당 세션 입력','초대한 교회 찬양팀에 참여','이번 주 악보와 송폼 확인'];
 return <main className="entry-shell">
  <section className="entry-card" aria-labelledby="entry-title">
   <div className="entry-kicker"><Mark/><span>생명의 찬양 · 시작하기</span></div>
   <h1 id="entry-title">함께 준비하는 예배,<br/>한곳에 모이는 찬양.</h1>
   <p className="entry-description">이번 주 말씀부터 악보와 송폼까지.<br/>우리 교회 찬양팀과 같은 화면에서 준비하세요.</p>
   {entry.issue?<div className="entry-message" role="alert"><p>{entry.issue}</p><a href="/" className="text-button">초대 정보 없이 시작하기 <ArrowRight size={16}/></a></div>:<>
    {invited?<div className="entry-invitation"><Check size={18}/><div><strong>{leader?'인도자 초대 링크':'찬양팀 초대 링크'}로 들어왔어요</strong><small>로그인 후 이 초대 코드로 이어집니다. 유효 여부는 가입 시 확인합니다.</small></div></div>:<fieldset className="entry-role"><legend>어떻게 이용하시나요?</legend><div>{(['team','leader'] as const).map(value=><label key={value} className={role===value?'selected':''}><input type="radio" name="entry-role" value={value} checked={role===value} onChange={()=>{setRole(value);setCode('');setCopyStatus('')}}/>{value==='team'?<Users size={20}/>:<ShieldCheck size={20}/>}<span><strong>{value==='team'?'찬양팀':'인도자'}</strong><small>{value==='team'?'초대한 교회에 참여':'새 교회 개설 신청'}</small></span></label>)}</div></fieldset>}
    <ol className="entry-steps" aria-label={leader?'인도자 가입 순서':'찬양팀 가입 순서'}>{steps.map((step,i)=><li key={step}><span>{i+1}</span>{step}</li>)}</ol>
    {!invited&&<details className="entry-code"><summary>초대 코드를 직접 입력할게요</summary><label>{leader?'총관리자에게 받은 인도자 코드':'인도자에게 받은 찬양팀 코드'}<input value={code} onChange={e=>setCode(e.target.value.trim())} maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="초대 코드 붙여넣기"/></label></details>}
    <a className="primary entry-login" href={signInPath(returnTo)} target="_top">ChatGPT로 로그인하고 계속 <ArrowRight size={18}/></a>
    <p className="entry-auth-note">현재 ChatGPT 계정으로 로그인합니다. 기존 회원은 이전에 사용한 계정으로 들어와 주세요.</p>
    {leader&&<p className="entry-permission">인도자 선택만으로 관리 권한이 생기지 않습니다. 초대 코드와 총관리자 승인이 필요합니다.</p>}
    {invited&&<a className="text-button" href="/">다른 초대로 시작하기</a>}
   </>}
   <details className="entry-help"><summary>카카오톡에서 로그인이 잘 안 되나요?</summary><p>브라우저 메뉴에서 외부 브라우저로 열거나, 아래 링크를 복사해 아이폰은 Safari, 안드로이드는 Chrome 주소창에 붙여넣어 주세요.</p><button type="button" className="secondary" onClick={async()=>{try{await copyText(location.origin+returnTo);setCopyStatus('초대 정보를 포함한 링크를 복사했습니다.')}catch{setCopyStatus('아래 링크를 길게 눌러 복사해 주세요.')}}}><Copy size={16}/>현재 가입 링크 복사</button>{copyStatus&&<><p role="status">{copyStatus}</p><input aria-label="복사할 가입 링크" readOnly value={typeof location==='undefined'?'':location.origin+returnTo} onFocus={e=>e.currentTarget.select()}/></>}</details>
  </section>
  <aside className="entry-preview" aria-label="앱 기능 미리보기">
   <div className="entry-preview-heading"><Music2 size={21}/><span>{leader?'예배 준비부터 팀 공개까지':'우리 찬양팀의 예배 준비 공간'}</span></div>
   <img src={'/guides/'+(leader?'leader-2':'team-1')+'.svg'} alt={leader?'도서관에서 필요한 곡을 개별 선택해 불러오는 화면 예시':'이번 주 말씀과 찬양 목록을 확인하는 화면 예시'} width={640} height={480}/>
   <h2>{leader?'한 번 준비하고, 팀과 함께.':'같은 악보로, 같은 마음으로.'}</h2>
   <p>{leader?'도서관에서 곡을 고르고 송폼을 편집해 팀에 공개하세요.':'이번 주 악보를 보고 내 연주 표시를 더해 연습하세요.'}</p>
   <span className="entry-preview-caption">기능 안내용 예시 화면</span>
  </aside>
 </main>;
}

export function EntryRecovery({expired,error,retry,signInPath:href}:{expired:boolean;error:string;retry:()=>void|Promise<void>;signInPath:string}){
 const [busy,setBusy]=useState(false);
 return <main className="setup-wrap"><section className="setup-card panel entry-recovery" aria-labelledby="recovery-title"><Mark/><h1 id="recovery-title">{expired?'다시 로그인해 주세요':'연결을 확인하고 있어요'}</h1><p role="alert">{error}</p><p className="subtle">{expired?'기존에 사용한 계정으로 로그인하면 교회 소속과 저장된 자료를 다시 확인할 수 있습니다.':'가입 화면을 열기 전에 계정 정보를 확인해야 합니다. 연결을 다시 시도해 주세요.'}</p>{expired&&<a className="primary full" href={href} target="_top">다시 로그인 <ArrowRight size={18}/></a>}<button className="secondary full" disabled={busy} onClick={async()=>{setBusy(true);try{await retry()}finally{setBusy(false)}}}><RefreshCw size={17} className={busy?'spin':''}/>{busy?'연결 확인 중…':'다시 연결'}</button></section></main>;
}
