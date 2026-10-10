import type {Note,Song} from './types';

export type ScoreViewMember={id:string;name:string;position:string};
export type SongNotes={notes:Note[];basedVersion:number;revision:number;updated:number};
export type ScoreView={serviceId:string;version:number;userId:string|null;name:string;position:string;own:boolean;members:ScoreViewMember[];songs:Record<string,SongNotes>};
export const sessionLabel=(position:string)=>position==='싱어'?'보컬':position;
export function scoreViewLabel(view:Pick<ScoreView,'userId'|'own'|'name'|'position'>){
 return view.userId?`${view.own?'내 악보 · ':''}${sessionLabel(view.position)} · ${view.name}`:'공통 송폼 악보';
}
export function notesForSong(view:ScoreView,song:Song){
 const record=view.songs[song.id],all=record?.notes||[],pages=new Set(song.pages.map(p=>p.id));
 return {notes:all.filter(n=>pages.has(n.pageId)),missing:all.filter(n=>!pages.has(n.pageId)),needsReview:!!all.length&&record.basedVersion!==view.version,basedVersion:record?.basedVersion??view.version};
}
// Read-only views never use old personal image exports: note edits are authoritative.
export function notesForPage(view:ScoreView,song:Song,pageId:string){return notesForSong(view,song).notes.filter(n=>n.pageId===pageId)}
