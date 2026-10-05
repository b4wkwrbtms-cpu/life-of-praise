export const MUSICIAN_POSITIONS = ['드럼','건반','베이스','싱어','일렉','세컨'] as const;
export const POSITIONS = [...MUSICIAN_POSITIONS,'성도','교역자','인도자'] as const;
export const SECTIONS = ['Intro','V','V1','V2','PC','C','Cx2','Inter','Bridge','Bridge x 2','Outro'] as const;
export type Position = typeof POSITIONS[number];
export type Section = { id: string; type: typeof SECTIONS[number] };
export type ScorePage = { source?:string; id: string; width: number; height: number; layout?:Layout };
export type Layout = { x:number; y:number; width:number; size:number; margin:boolean; leftMargin?:boolean; markerStyle?:'inline'; markerSize?:number };
export type SectionMarker = { id:string; pageId:string; type:typeof SECTIONS[number]; x?:number; y:number; size:number };
export type LibrarySource = {serviceId:string;songId:string;kind:'complete'|'draft'};
export type Song = { librarySource?:LibrarySource; fixedId?:string; id:string; title:string; key:string; bpm:string; form:Section[]; markers?:SectionMarker[]; pages:ScorePage[]; exports:string[]; layout:Layout; notes:string; transition:string; parts:Record<string,string>; link:string };
export type Worship = { title:string; date:string; passage:string; translation:string; scripture:string; theme:string; rehearsal:string; notice:string; songs:Song[] };
export type FixedSong = {id:string;title:string;data:Song;revision:number;autoAdd:boolean;updated:number};
export type Service = { pendingEdit?:boolean; deleted?:boolean; hasDraft?:boolean; id:string; date:string; title:string; data:Worship; version:number; revision:number; published:boolean; finalized:boolean; updated:number; changes:string[]; draft?:Worship; seen:number };
export type Profile = { id:string; name:string; position:Position; role:'admin'|'member'; active:number; churchId?:string; superAdmin?:boolean; leaderRequested?:number };
export type Church = {id:string;name:string;active:number;role?:'admin'|'member';leaderRequested?:number;memberCount?:number;serviceCount?:number;leaders?:string};
export type ChurchApplication={id:string;user_id:string;name:string;church_name:string;status:'pending'|'approved'|'rejected';church_id:string|null;reason:string;created:number;reviewed:number|null;inviteLabel?:string};
export const REQUEST_STATUSES={received:'접수',reviewing:'검토 중',working:'진행 중',done:'완료',held:'보류'} as const;
export const REQUEST_CATEGORIES=['기능 추가','오류 수정','화면 개선','기타'] as const;
export type DeveloperRequest={id:string;church_id:string;church_name:string;user_id:string;author:string;title:string;category:string;details:string;status:keyof typeof REQUEST_STATUSES;revision:number;created:number;updated:number;replyCount:number};
export type DeveloperReply={id:string;text:string;author:string;developer:number;created:number};
export type Note = { id:string; pageId:string; x:number; y:number; text:string; size:number; color:string; sectionId?:string };
export type Personal = { notes:Note[]; basedVersion:number; reviewed:boolean; revision:number; exports:string[] };
export type Comment = { id:string; service_id:string; song_id:string; user_id:string; name:string; position:string; text:string; parent_id:string; attachment:string; resolved:number; pinned:number; version:number; created:number };
export const DEFAULT_LAYOUT:Layout={x:.05,y:.025,width:.9,size:.022,margin:false,leftMargin:false,markerStyle:'inline'};
export function newSong():Song{return {id:crypto.randomUUID(),title:'',key:'',bpm:'',form:[],pages:[],exports:[],layout:{...DEFAULT_LAYOUT},notes:'',transition:'',parts:{},link:''};}
export function nextSunday(){const now=new Date();const d=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Seoul'}));d.setDate(d.getDate()+((7-d.getDay())%7));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function newWorship():Worship{return {title:'주일예배',date:nextSunday(),passage:'',translation:'',scripture:'',theme:'',rehearsal:'',notice:'',songs:[]};}
export function formText(s:Song){return s.form.map(f=>f.type).join(' - ');}
export function dateLabel(d:string){return new Date(d+'T12:00:00+09:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'});}
export function parseSongForm(text:string):Section['type'][] {
 const normalized=text.replace(/bridge\s*[x×]\s*2/gi,'Bridge_x_2').replace(/c\s*[x×]\s*2/gi,'Cx2');
 const tokens=normalized.trim().split(/\s*[-–—>→,·/\n]+\s*|\s+/).filter(Boolean);
 if(!tokens.length)throw new Error('송폼을 먼저 입력해 주세요.');
 if(tokens.length>100)throw new Error('송폼은 100개 구간까지 넣을 수 있습니다.');
 return tokens.map(t=>{const type=SECTIONS.find(s=>s.toLowerCase()===t.replaceAll('_',' ').toLowerCase());if(!type)throw new Error(`“${t}” 구간을 확인해 주세요. ${SECTIONS.join(' · ')} 사용 가능`);return type;});
}
export function publicationIssues(d:Worship):{label:string;songId?:string}[]{
 const issues:{label:string;songId?:string}[]=[];
 if(!d.title.trim())issues.push({label:'예배 이름을 입력해 주세요.'});
 if(!d.date||isNaN(Date.parse(d.date)))issues.push({label:'예배 날짜를 선택해 주세요.'});
 if(!d.passage.trim())issues.push({label:'본문 범위를 입력해 주세요.'});
 if(!d.scripture.trim())issues.push({label:'본문 말씀을 입력해 주세요.'});
 if(!d.songs.length)issues.push({label:'찬양을 추가해 주세요.'});
 d.songs.forEach((s,i)=>{const missing=[!s.title.trim()&&'제목',!s.pages.length&&'악보',!s.form.length&&'송폼'].filter(Boolean);if(missing.length)issues.push({label:`${i+1}. ${s.title||'새 찬양'}: ${missing.join(' · ')} 필요`,songId:s.id});});
 return issues;
}
export function nextCopyDate(sourceDate:string,today=nextSunday()){
 const next=new Date(sourceDate+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+7);
 const date=next.toISOString().slice(0,10);return date>today?date:today;
}
export function selectCurrentService(services:Service[],selected:string,today:string){
 const exact=services.find(s=>s.id===selected);if(exact)return exact;
 const published=services.filter(s=>s.published);const pool=published.length?published:services;
 return [...pool].sort((a,b)=>a.date.localeCompare(b.date)).find(s=>s.date>=today)||[...pool].sort((a,b)=>b.date.localeCompare(a.date))[0];
}
export function weekShareText(d:Worship,options:{scripture:boolean;form:boolean;notice:boolean;links:boolean}){
 const songs=d.songs.map((s,i)=>{
  const lines=[`${i+1}. ${s.title}${s.key?' · '+s.key+' Key':''}`];
  if(options.form)lines.push('송폼: '+formText(s));
  if(options.links&&s.link.trim()){
   try{const url=new URL(s.link.trim());if(['https:','http:'].includes(url.protocol)){const youtube=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be'].includes(url.hostname);lines.push(`${youtube?'유튜브':'참고 음원'}: ${s.link.trim()}`)}}catch{}
  }
  return lines.join('\n');
 });
 return [`[${d.date} ${d.title}]`,'',`📖 이번 주 말씀 | ${d.passage}${d.translation?' ('+d.translation+')':''}`,...(options.scripture?[d.scripture]:[]),'','🎵 찬양 순서',...songs,...(options.notice&&d.rehearsal?['',`연습 안내: ${d.rehearsal}`]:[]),...(options.notice&&d.notice?['',`공지: ${d.notice}`]:[])].join('\n');
}

// Each import is an independent song; saved originals and other services remain untouched.
export function cloneFixedSongs(items:FixedSong[]):Song[]{return items.map(f=>({...structuredClone(f.data),id:crypto.randomUUID(),fixedId:f.id,exports:[],form:f.data.form.map(s=>({...s,id:crypto.randomUUID()})),markers:f.data.markers?.map(m=>({...m,id:crypto.randomUUID()}))}));}
