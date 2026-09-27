export const MUSICIAN_POSITIONS = ['드럼','건반','베이스','싱어','일렉','세컨'] as const;
export const POSITIONS = [...MUSICIAN_POSITIONS,'성도','교역자'] as const;
export const SECTIONS = ['Intro','V','V1','V2','PC','C','Inter','Bridge','Outro'] as const;
export type Position = typeof POSITIONS[number];
export type Section = { id: string; type: typeof SECTIONS[number] };
export type ScorePage = { source?:string; id: string; width: number; height: number; layout?:Layout };
export type Layout = { x:number; y:number; width:number; size:number; margin:boolean; leftMargin?:boolean; markerStyle?:'inline'; markerSize?:number };
export type SectionMarker = { id:string; pageId:string; type:typeof SECTIONS[number]; x?:number; y:number; size:number };
export type Song = { fixedId?:string; id:string; title:string; key:string; bpm:string; form:Section[]; markers?:SectionMarker[]; pages:ScorePage[]; exports:string[]; layout:Layout; notes:string; transition:string; parts:Record<string,string>; link:string };
export type Worship = { title:string; date:string; passage:string; translation:string; scripture:string; theme:string; rehearsal:string; notice:string; songs:Song[] };
export type FixedSong = {id:string;title:string;data:Song;revision:number;autoAdd:boolean;updated:number};
export type Service = { deleted?:boolean; hasDraft?:boolean; id:string; date:string; title:string; data:Worship; version:number; revision:number; published:boolean; finalized:boolean; updated:number; changes:string[]; draft?:Worship; seen:number };
export type Profile = { id:string; name:string; position:Position; role:'admin'|'member'; active:number };
export type Note = { id:string; pageId:string; x:number; y:number; text:string; size:number; color:string; sectionId?:string };
export type Personal = { notes:Note[]; basedVersion:number; reviewed:boolean; revision:number; exports:string[] };
export type Comment = { id:string; service_id:string; song_id:string; user_id:string; name:string; position:string; text:string; parent_id:string; attachment:string; resolved:number; pinned:number; version:number; created:number };
export const DEFAULT_LAYOUT:Layout={x:.05,y:.025,width:.9,size:.022,margin:false,leftMargin:false,markerStyle:'inline'};
export function newSong():Song{return {id:crypto.randomUUID(),title:'',key:'',bpm:'',form:[],pages:[],exports:[],layout:{...DEFAULT_LAYOUT},notes:'',transition:'',parts:{},link:''};}
export function nextSunday(){const now=new Date();const d=new Date(now.toLocaleString('en-US',{timeZone:'Asia/Seoul'}));d.setDate(d.getDate()+((7-d.getDay())%7));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function newWorship():Worship{return {title:'주일예배',date:nextSunday(),passage:'',translation:'',scripture:'',theme:'',rehearsal:'',notice:'',songs:[]};}
export function formText(s:Song){return s.form.map(f=>f.type).join(' - ');}
export function dateLabel(d:string){return new Date(d+'T12:00:00+09:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'});}
