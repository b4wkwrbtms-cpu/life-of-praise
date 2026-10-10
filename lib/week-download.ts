import {Zip,ZipPassThrough} from 'fflate';
import type {Service} from './types';

export type DownloadEntry={songTitle:string;songNumber:number;pageNumber:number;exportId:string;baseName:string};
export type DownloadProgress={done:number;total:number;title:string};
export type ScoreBundle={blob:Blob;name:string;files:File[];pageCount:number;songCount:number};
export const MAX_BUNDLE_BYTES=80*1024*1024;
const safeName=(name:string,fallback:string)=>Array.from(name.normalize('NFC').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g,' ').replace(/\s+/g,' ').replace(/^[. ]+|[. ]+$/g,'')).slice(0,55).join('')||fallback;
const abort=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('준비를 취소했습니다.','AbortError')};

export function weekDownloadEntries(service:Service):DownloadEntry[]{
 if(!service.published)throw new Error('팀에 공개한 악보부터 전체 다운로드할 수 있습니다.');
 if(!service.data.songs.length)throw new Error('다운로드할 찬양이 없습니다.');
 return service.data.songs.flatMap((song,si)=>{
  if(!song.pages.length)throw new Error(`${song.title||'제목 없는 찬양'}에 악보가 없습니다.`);
  return song.pages.map((_,pi)=>{
   if(!song.exports[pi]&&!song.renderOnRead)throw new Error(`${song.title} ${pi+1}페이지의 완성 악보가 없습니다. 인도자에게 다시 공개해 달라고 요청해 주세요.`);
   return {songTitle:song.title,songNumber:si+1,pageNumber:pi+1,exportId:song.exports[pi]||'',baseName:`${String(si+1).padStart(2,'0')}_${safeName(song.title,'찬양')}_p${String(pi+1).padStart(2,'0')}`};
  });
 });
}

export async function fetchScoreFile(url:string,signal:AbortSignal):Promise<Blob>{
 abort(signal);const controller=new AbortController();let timedOut=false;
 const cancel=()=>controller.abort();signal.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},45_000);
 try{
  const response=await fetch(url,{signal:controller.signal,cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error(response.status===401?'로그인이 만료되었습니다. 다시 로그인한 뒤 다운로드해 주세요.':'악보 파일을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
  const blob=await response.blob();abort(signal);
  if(!blob.size||blob.size>22*1024*1024)throw new Error('악보 파일의 크기를 확인할 수 없습니다.');
  return blob;
 }catch(e){
  abort(signal);
  if(timedOut)throw new Error('악보를 불러오는 시간이 길어졌습니다. 연결을 확인하고 다시 시도해 주세요.');
  if(e instanceof TypeError)throw new Error('인터넷 연결을 확인하고 다시 시도해 주세요.');
  throw e;
 }finally{clearTimeout(timer);signal.removeEventListener('abort',cancel)}
}

// Store already-compressed images unchanged. Fetch one page at a time; never
// offer a partial archive if a page fails or the user cancels.
export async function createScoreBundle(service:Service,load:(entry:DownloadEntry,signal:AbortSignal)=>Promise<Blob>,options:{signal?:AbortSignal;onProgress?:(progress:DownloadProgress)=>void;maxBytes?:number;viewLabel?:string;cacheByPage?:boolean}={}):Promise<ScoreBundle>{
 const signal=options.signal||new AbortController().signal,entries=weekDownloadEntries(service);
 const chunks:BlobPart[]=[],files:File[]=[],cache=new Map<string,Blob>();let totalBytes=0,zipError:Error|null=null,finished=false;
 const zip=new Zip((error,data,final)=>{if(error){zipError=error;return;}chunks.push(new Uint8Array(data).buffer);if(final)finished=true});
 try{
  for(const [index,entry] of entries.entries()){
   abort(signal);options.onProgress?.({done:index,total:entries.length,title:`${entry.songNumber}. ${entry.songTitle} · ${entry.pageNumber}페이지`});
   // The same common image can have different annotations in two songs.
   const cacheKey=(options.cacheByPage||!entry.exportId)?`${entry.songNumber}:${entry.pageNumber}`:entry.exportId;
   let blob=cache.get(cacheKey);if(!blob){blob=await load(entry,signal);cache.set(cacheKey,blob)}
   abort(signal);totalBytes+=blob.size;
   if(totalBytes>(options.maxBytes??MAX_BUNDLE_BYTES))throw new Error('악보 전체 용량이 커서 한 번에 준비할 수 없습니다. 각 곡의 악보 저장 기능을 이용해 주세요.');
   const data=new Uint8Array(await blob.arrayBuffer());abort(signal);
   const png=[137,80,78,71,13,10,26,10].every((b,i)=>data[i]===b),jpeg=data[0]===255&&data[1]===216&&data[2]===255;
   if(!png&&!jpeg)throw new Error(`${entry.songTitle} ${entry.pageNumber}페이지가 올바른 악보 이미지가 아닙니다. 다시 시도해 주세요.`);
   const name=entry.baseName+(png?'.png':'.jpg'),file=new File([blob],name,{type:png?'image/png':'image/jpeg'});
   files.push(file);const stream=new ZipPassThrough(name);zip.add(stream);stream.push(data,true);
   if(zipError)throw zipError;
   options.onProgress?.({done:index+1,total:entries.length,title:`${entry.songNumber}. ${entry.songTitle} · ${entry.pageNumber}페이지`});
   // Yield between pages so cancellation and progress updates can paint.
   await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  abort(signal);zip.end();if(zipError)throw zipError;if(!finished)throw new Error('전체 악보를 묶지 못했습니다. 다시 시도해 주세요.');
  return {blob:new Blob(chunks,{type:'application/zip'}),name:`${safeName(service.date,'예배')}_${safeName(service.title,'찬양')}_v${service.version}${options.viewLabel?'_'+safeName(options.viewLabel,'악보'):''}_전체악보.zip`,files,pageCount:entries.length,songCount:service.data.songs.length};
 }catch(e){zip.terminate();throw e}finally{cache.clear()}
}
