import type {LibrarySource,Service,Song} from './types';

export type LibrarySong = LibrarySource & {id:string;date:string;serviceTitle:string;version:number;song:Song};
export function librarySongKey(source:LibrarySource){return `${source.serviceId}:${source.kind}:${source.songId}`;}

// Match the library's complete/draft views, excluding the current service and trash.
export function librarySongs(services:Service[],currentServiceId:string):LibrarySong[]{
 return services.filter(s=>s.id!==currentServiceId&&!s.deleted).flatMap(service=>{
  const kinds:LibrarySource['kind'][]=service.published?service.hasDraft?['complete','draft']:['complete']:['draft'];
  return kinds.flatMap(kind=>{
   const data=kind==='draft'?(service.draft||service.data):service.data;
   return data.songs.map(song=>{const source={serviceId:service.id,songId:song.id,kind};return {...source,id:librarySongKey(source),date:data.date,serviceTitle:data.title,version:service.version,song};});
  });
 }).sort((a,b)=>b.date.localeCompare(a.date));
}

// Reuse immutable uploaded files; clone all editable data and assign fresh annotation IDs.
export function importLibrarySongs(existing:Song[],picked:LibrarySong[]):Song[]{
 const seen=new Set(existing.flatMap(s=>s.librarySource?[librarySongKey(s.librarySource)]:[]));
 const entries=picked.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
 if(existing.length+entries.length>30)throw new Error('한 예배는 30곡까지 추가할 수 있습니다. 선택한 곡 수를 줄여 주세요.');
 return entries.map(item=>{
  const copy=structuredClone(item.song);delete copy.fixedId;
  return {...copy,id:crypto.randomUUID(),librarySource:{serviceId:item.serviceId,songId:item.songId,kind:item.kind},exports:[],form:copy.form.map(f=>({...f,id:crypto.randomUUID()})),markers:copy.markers?.map(m=>({...m,id:crypto.randomUUID()}))};
 });
}
