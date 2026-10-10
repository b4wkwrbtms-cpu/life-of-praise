import type {Worship} from './types';

// Keep the actual score page visible when undo changes a song or page order.
export function retainEditorLocation(before:Worship,after:Worship,songId:string,pageIndex:number){
 const oldSong=before.songs.find(s=>s.id===songId),pageId=oldSong?.pages[pageIndex]?.id;
 const song=after.songs.find(s=>s.id===songId);
 if(!song)return {songId:after.songs[0]?.id||'',pageIndex:0};
 const preserved=pageId?song?.pages.findIndex(p=>p.id===pageId):-1;
 return {songId:song?.id||'',pageIndex:preserved!==undefined&&preserved>=0?preserved:Math.max(0,Math.min(pageIndex,(song?.pages.length||1)-1))};
}

export function rememberedSongPage(data:Worship,songId:string,pageId?:string){
 const song=data.songs.find(s=>s.id===songId);
 if(!song)return null;
 return {songId:song.id,pageIndex:Math.max(0,song.pages.findIndex(p=>p.id===pageId))};
}

export type WorkbenchViewport={top:number;height:number};
// Native zoom remains native; don't continuously resize the paper under a pinch.
export function measureWorkbenchViewport(width:number,viewport:{height:number;offsetTop:number;scale:number}|null):WorkbenchViewport|null{
 if(width>1000||!viewport||Math.abs(viewport.scale-1)>.02||!Number.isFinite(viewport.height)||viewport.height<=0)return null;
 return {top:Math.max(0,Math.round(viewport.offsetTop)),height:Math.round(viewport.height)};
}
