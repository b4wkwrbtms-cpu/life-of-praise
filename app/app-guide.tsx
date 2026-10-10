'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Download,Share2,MoreVertical,X,Copy} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {api,copyText} from '@/lib/client';
import type {Profile} from '@/lib/types';
import {toast} from 'sonner';
type Platform='ios'|'android'|'desktop';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export const PLATFORM_NAMES={ios:'아이폰 · 아이패드',android:'안드로이드',desktop:'컴퓨터'};
export function devicePlatform():Platform {return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/Android/i.test(navigator.userAgent)?'android':'desktop'}
export function standalone(){return (navigator as Navigator&{standalone?:boolean}).standalone===true||window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: window-controls-overlay)').matches}
const slides={
 leader:[
  {title:'한 주의 예배를 준비해요',text:'이번 주에서 ‘예배 준비’를 누르고 날짜, 본문 말씀, 연습 안내를 적어 주세요.',alt:'예배 준비 화면: 예배 날짜, 본문 말씀, 연습 안내를 차례로 입력합니다.'},
  {title:'찬양을 골라 순서를 만들어요',text:'새 악보를 올리거나 도서관·고정찬양에서 필요한 곡만 불러오세요. 송폼도 순서대로 넣을 수 있어요.',alt:'도서관에서 선택한 두 곡을 불러와 Intro, V, C, Cx2 송폼을 만듭니다.'},
  {title:'악보 위에 송폼을 놓아요',text:'‘악보 · 구간 표시’에서 스크롤, 송폼 이동, 구간 표시를 골라 위치와 크기를 조절하세요.',alt:'악보 편집 도구에서 송폼 이동과 구간 표시를 선택하고 악보 위에 배치합니다.'},
  {title:'팀에 공개하고 함께 준비해요',text:'편집을 마치면 ‘팀에 공개’를 누르세요. 내 정보에서 팀원을 초대하고, 카톡용 복사로 말씀·송폼·음원 링크를 전할 수 있어요.',alt:'팀에 공개한 예배를 찬양팀이 확인하고 초대 링크와 카톡용 복사를 사용할 수 있습니다.'},
  {title:'홈 화면에서 바로 시작해요',text:'기기에 맞게 설치한 뒤 홈 화면 아이콘으로 열어 주세요. 내 정보의 찬양팀 목록에서 팀원들의 앱 실행 확인 상태도 볼 수 있어요.',alt:'홈 화면에 추가한 생명의 찬양 아이콘을 눌러 앱을 실행합니다.'}
 ],
 team:[
  {title:'이번 주 예배를 한눈에',text:'‘이번 주’에서 찬양 순서, 본문 말씀, 연습 시간과 공지를 확인하세요.',alt:'이번 주 화면에 찬양 순서와 본문 말씀, 연습 안내가 모여 있습니다.'},
  {title:'내 악보에 연주 표시를 해요',text:'곡을 눌러 내 연주 표시를 더하세요. 전체 악보에서는 내 메모가 함께 보이고, 같은 교회 팀원의 악보도 이름별로 선택할 수 있어요.',alt:'공통 송폼 아래에 나만의 연주 메모가 표시된 악보입니다.'},
  {title:'합주할 때는 크게 펼쳐요',text:'‘전체화면 합주’를 누르면 곡 순서대로 악보를 볼 수 있어요. 확대해서 보고 다음 곡으로 넘겨 보세요.',alt:'전체화면 합주에서 첫 곡과 다음 곡의 악보를 순서대로 봅니다.'},
  {title:'질문하고 지난 악보도 찾아요',text:'‘소통’에서 궁금한 점을 남기고, ‘악보도서관’에서 지난 예배의 완성 악보를 다시 찾아보세요.',alt:'소통의 곡별 질문과 악보도서관의 지난 예배 목록입니다.'},
  {title:'앱 아이콘으로 편하게 열어요',text:'설치 후 홈 화면의 ‘생명의 찬양’을 한 번 열어 주세요. 인도자에게 기기 종류와 앱 실행 확인 날짜가 표시돼요.',alt:'홈 화면의 생명의 찬양 아이콘을 누르면 앱 실행이 확인됩니다.'}
 ]
};
export default function AppGuide({profile,request}:{profile:Profile|null;request:{id:number;install:boolean}|null}){
 const [open,setOpen]=useState(false),[step,setStep]=useState(0),[platform,setPlatform]=useState<Platform>('desktop'),[prompt,setPrompt]=useState<InstallPrompt|null>(null),[inApp,setInApp]=useState(false),[running,setRunning]=useState(false),[installed,setInstalled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const body=useRef<HTMLDivElement>(null),touch=useRef<{x:number;y:number}|null>(null),reportAt=useRef(0),manualOpen=useRef(false);
 const role=profile?.role==='admin'?'leader':'team',slide=slides[role][step];
 useEffect(()=>{
  setPlatform(devicePlatform());setRunning(standalone());setInApp(/KAKAOTALK|Instagram|FBAN|FBAV|Line\/|ChatGPT/i.test(navigator.userAgent));
  const available=(e:Event)=>{e.preventDefault();setPrompt(e as InstallPrompt)};
  window.addEventListener('beforeinstallprompt',available);return()=>window.removeEventListener('beforeinstallprompt',available);
 },[]);
 useEffect(()=>{
  if(!profile){setOpen(false);return;}let alive=true;reportAt.current=0;manualOpen.current=false;setError('');
  api('app-setup').then(d=>{if(alive&&!d.completed&&!manualOpen.current){setStep(0);setOpen(true)}}).catch(()=>{if(alive){setError('안내 확인 기록을 불러오지 못했어요. 안내를 읽고 다시 시도해 주세요.');setOpen(true)}});
  const report=async(event:'installed'|'launched')=>{
   if(event==='launched'&&Date.now()-reportAt.current<3600000)return;
   try{await api('app-setup','POST',{action:'installation',platform:devicePlatform(),event});if(alive){if(event==='launched')reportAt.current=Date.now();setInstalled(true)}}catch{if(alive)setError('앱 실행 확인을 저장하지 못했어요. 연결 후 다시 확인해 주세요.')}
  };
  const launch=()=>{if(document.visibilityState==='visible'&&standalone()){setRunning(true);void report('launched')}};
  const installedEvent=()=>{setPrompt(null);setInstalled(true);void report('installed')};
  launch();window.addEventListener('appinstalled',installedEvent);window.addEventListener('pageshow',launch);document.addEventListener('visibilitychange',launch);window.addEventListener('online',launch);
  const media=window.matchMedia('(display-mode: standalone)');media.addEventListener('change',launch);
  return()=>{alive=false;window.removeEventListener('appinstalled',installedEvent);window.removeEventListener('pageshow',launch);document.removeEventListener('visibilitychange',launch);window.removeEventListener('online',launch);media.removeEventListener('change',launch)};
 },[profile?.id,profile?.churchId,profile?.role]);
 useEffect(()=>{if(request&&profile){manualOpen.current=true;setStep(request.install?4:0);setOpen(true)}},[request?.id]);
 useEffect(()=>{body.current?.scrollTo({top:0})},[step,platform]);
 const finish=async()=>{setBusy(true);setError('');try{await api('app-setup','POST',{action:'complete-guide'});setOpen(false)}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const install=async()=>{if(!prompt)return;setBusy(true);try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')toast.info('설치가 끝나면 홈 화면의 앱 아이콘으로 열어 주세요.')}catch{toast.info('브라우저 메뉴에서 홈 화면에 추가해 주세요.')}finally{setPrompt(null);setBusy(false)}};
 if(!profile)return null;
 return <Dialog open={open} onOpenChange={v=>!busy&&setOpen(v)}><DialogContent className="app-guide-dialog" showCloseButton={false}>
  <header className="guide-header"><span className="pill">{role==='leader'?'인도자':'찬양팀'} 시작 안내</span><span>{step+1} / 5</span><button className="icon-button" aria-label="소개 나중에 보기" disabled={busy} onClick={()=>setOpen(false)}><X size={20}/></button></header>
  <div className="guide-body" ref={body}>
   <div className="guide-copy" aria-live="polite"><DialogTitle>{slide.title}</DialogTitle><DialogDescription>{slide.text}</DialogDescription></div>
   <img className="guide-image" src={`/guides/${role}-${step+1}${step===4?'-'+platform:''}.svg`} alt={slide.alt} width="640" height="480" onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}} onTouchEnd={e=>{if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;touch.current=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)setStep(s=>Math.max(0,Math.min(4,s+(dx<0?1:-1))))}}/>
   {step===4&&<section className="install-instructions" aria-label="기기별 설치 안내">
    <div className="install-platforms" role="group" aria-label="설치 기기">{(Object.keys(PLATFORM_NAMES) as Platform[]).map(p=><button key={p} aria-pressed={platform===p} onClick={()=>setPlatform(p)}>{PLATFORM_NAMES[p]}</button>)}</div>
    {running?<p className="installation-confirmed"><CheckCircle2 size={18}/>이 기기에서 앱으로 실행 중이에요.</p>:<>
     {inApp&&<p className="install-browser-note">카카오톡 등 앱 안에서 열었다면 메뉴에서 외부 브라우저로 열어 주세요. 아래 ‘앱 주소 복사’로 Safari 또는 Chrome에 붙여 넣어도 됩니다.</p>}
     <ol>{platform==='ios'?<><li><strong>Safari로 이 앱을 열어요.</strong></li><li><Share2 size={16}/>공유 메뉴에서 <strong>홈 화면에 추가</strong>를 눌러요. 공유가 안 보이면 더 보기 메뉴를 확인하세요.</li><li><strong>웹 앱으로 열기</strong>가 보이면 켜고 <strong>추가</strong>를 눌러요.</li><li>홈 화면의 <strong>생명의 찬양</strong> 아이콘을 열고 같은 계정으로 로그인해 주세요.</li></>:platform==='android'?<><li><strong>Chrome으로 이 앱을 열어요.</strong></li><li><MoreVertical size={16}/>메뉴에서 <strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong>를 눌러요.</li><li><strong>설치</strong>를 확인하고 홈 화면의 앱 아이콘을 열어 주세요.</li></>:<><li><strong>Chrome 또는 Edge로 이 앱을 열어요.</strong></li><li>주소창의 설치 아이콘 또는 브라우저 메뉴의 <strong>앱 설치</strong>를 선택해요.</li><li>설치 메뉴가 없다면 브라우저에서 그대로 사용할 수 있어요.</li></>}</ol>
     {prompt&&platform===devicePlatform()&&<button className="primary full" disabled={busy} onClick={install}><Download size={18}/>앱 설치하기</button>}
     {installed&&<p className="installation-confirmed">설치 응답을 받았어요. 앱 아이콘으로 열면 실행 확인이 완료돼요.</p>}
    </>}
    <button className="secondary full" onClick={async()=>{try{await copyText(location.origin+'/');toast.success('앱 주소를 복사했습니다.')}catch{toast.error('주소를 복사하지 못했습니다. 브라우저 주소창에서 복사해 주세요.')}}}><Copy size={16}/>앱 주소 복사</button>
    <p className="install-disclosure">설치·앱 실행 확인 날짜와 기기 종류를 우리 교회 인도자에게 표시합니다. 삭제 여부는 자동 확인할 수 없어요. 설치하지 않아도 브라우저에서 사용할 수 있습니다.</p>
   </section>}
   {error&&<p className="error-panel" role="alert">{error}</p>}
  </div>
  <footer className="guide-footer"><div className="guide-pages" aria-label="소개 페이지">{slides[role].map((s,i)=><button key={s.title} aria-label={`${i+1}장: ${s.title}`} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}><span/></button>)}</div><div className="guide-navigation"><button className="secondary" disabled={step===0||busy} onClick={()=>setStep(s=>s-1)}>이전</button><button className="primary" disabled={busy} onClick={()=>step===4?finish():setStep(s=>s+1)}>{busy?'처리 중…':step===4?'시작하기':'다음'}</button></div><small>내 정보에서 소개와 설치 안내를 다시 볼 수 있어요.</small></footer>
 </DialogContent></Dialog>;
}
