'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/api-response';
import {DraftSaveQueue,readDraftBackups,writeDraftBackup,removeDraftBackup,saveDraftWithReconciliation,saveStateText,type DraftBackup,type DraftSaveState,type DraftScope} from '@/lib/draft-recovery';
import type {Service,Worship} from '@/lib/types';

export function useEditorDraft(service:Service,userId:string,churchId:string){
 const [data,setData]=useState<Worship>(()=>structuredClone(service.draft||service.data));
 const [state,setState]=useState<DraftSaveState>({phase:service.pendingEdit?'pending':'saved',error:'',backup:false});
 const [backups,setBackups]=useState<DraftBackup[]>([]),[ready,setReady]=useState(false),[storageIssue,setStorageIssue]=useState(false);
 const dataRef=useRef(data),mounted=useRef(false),paused=useRef(true),store=useRef<Storage|null>(null),id=useRef(''),scope=useRef<DraftScope>({userId,churchId,serviceId:service.id});
 const queueRef=useRef<DraftSaveQueue|null>(null);
 // Capture the church at editor creation: a background response cannot change its scope.
 const request=async<T=any>(path:string,method='GET',body?:unknown)=>requestJson<T>('/api/'+path,{method,credentials:'same-origin',headers:{'X-Church-Id':churchId,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 if(!queueRef.current)queueRef.current=new DraftSaveQueue({data,revision:service.revision,forcePending:service.pendingEdit,online:()=>typeof navigator==='undefined'||navigator.onLine,
  write:(snapshot,revision)=>saveDraftWithReconciliation(request,service.id,snapshot,revision),
  checkpoint:(current,base,revision,dirty)=>{
   if(!store.current||!id.current)return false;
   try{if(dirty)writeDraftBackup(store.current,scope.current,{format:1,id:id.current,updated:Date.now(),revision,base,data:current});else removeDraftBackup(store.current,scope.current,id.current);if(mounted.current)setStorageIssue(false);return dirty}catch{if(mounted.current)setStorageIssue(true);return false}
  },changed:next=>{if(mounted.current)setState(next)}
 });
 const queue=queueRef.current;
 useEffect(()=>{
  mounted.current=true;if(!id.current)id.current=crypto.randomUUID();
  let found:DraftBackup[]=[];
  try{store.current=window.localStorage;found=readDraftBackups(store.current,scope.current,service.draft||service.data).filter(b=>b.id!==id.current)}catch{setStorageIssue(true)}
  setBackups(found);paused.current=found.length>0;setReady(true);
  if(!found.length)queue.checkpoint();
  return()=>{mounted.current=false};
 },[]);
 const replace=(next:Worship)=>{dataRef.current=next;setData(next);queue.update(next)};
 const flush=()=>paused.current?Promise.reject(new Error('먼저 이전 편집 내용의 복구 여부를 선택해 주세요.')):queue.flush();
 useEffect(()=>{if(!ready||backups.length||state.phase==='conflict')return;const timer=setTimeout(()=>{queue.flush().catch(()=>{})},1200);return()=>clearTimeout(timer)},[data,ready,backups.length]);
 useEffect(()=>{
  const retry=()=>{if(!paused.current)queue.flush().catch(()=>{})};
  const checkpoint=()=>{if(!paused.current)queue.checkpoint()};
  const hidden=()=>{if(document.visibilityState==='hidden')checkpoint()};
  const warn=(event:BeforeUnloadEvent)=>{if(queue.dirty){checkpoint();event.preventDefault();event.returnValue=''}};
  window.addEventListener('online',retry);window.addEventListener('pagehide',checkpoint);window.addEventListener('beforeunload',warn);document.addEventListener('visibilitychange',hidden);
  return()=>{window.removeEventListener('online',retry);window.removeEventListener('pagehide',checkpoint);window.removeEventListener('beforeunload',warn);document.removeEventListener('visibilitychange',hidden)};
 },[]);
 const consume=(backup:DraftBackup)=>{try{if(store.current)removeDraftBackup(store.current,scope.current,backup.id)}catch{setStorageIssue(true)}const remaining=backups.filter(b=>b.id!==backup.id);setBackups(remaining);paused.current=remaining.length>0;return remaining};
 const restore=(backup:DraftBackup)=>{
  // Move into our own record before removing the old record, so a failed local
  // write cannot destroy the only recovery copy.
  replace(structuredClone(backup.data));if(queue.state.backup)consume(backup);
  // Other editor instances remain recoverable on the next visit; choosing one
  // backup must not immediately replace it with another recovery prompt.
  paused.current=false;setBackups([]);
 };
 const copyAsNew=async(source:Worship,backup?:DraftBackup)=>{
  const copy=structuredClone(source);copy.title=(copy.title||'예배').slice(0,150)+' · 복구본';copy.songs=copy.songs.map(s=>({...s,exports:[]}));
  const created=await request<{id:string;revision:number}>('services','POST',copy);
  if(backup)consume(backup);
  // This editor's unsaved content is now safely stored in a separate service.
  try{if(store.current)removeDraftBackup(store.current,scope.current,id.current)}catch{}
  return {id:created.id,revision:created.revision,data:copy,draft:copy,title:copy.title,date:copy.date,version:0,published:false,finalized:false,updated:Date.now(),changes:[],seen:0} as Service;
 };
 return {data,dataRef,replace,flush,state,status:saveStateText(state),ready,storageIssue,backups,restore,consume,copyAsNew,request,queue,checkpoint:()=>queue.checkpoint()};
}
