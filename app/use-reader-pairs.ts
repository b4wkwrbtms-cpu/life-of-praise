'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/api-response';
import type {ReaderPair,ReaderPairSettings} from '@/lib/reader-pairs';

export function useReaderPairs(serviceId:string,version:number,churchId:string,userId:string){
 const [attempt,setAttempt]=useState(0);
 const key=JSON.stringify([churchId,userId,serviceId,version,attempt]);
 const [result,setResult]=useState<{key:string;data:ReaderPairSettings|null;error:string}>({key:'',data:null,error:''});
 const [mutation,setMutation]=useState<{key:string;busy:boolean;error:string}>({key:'',busy:false,error:''});
 const current=useRef<string|null>(key),pending=useRef<string|null>(null);current.current=key;
 const route=`/api/services/${encodeURIComponent(serviceId)}/reader-pairs?version=${version}`;
 const options={headers:{'X-Church-Id':churchId},credentials:'same-origin' as const,cache:'no-store' as const};
 useEffect(()=>{
  let live=true;current.current=key;
  requestJson<ReaderPairSettings>(route,options).then(data=>{if(live)setResult({key,data,error:''})}).catch(error=>{if(live)setResult({key,data:null,error:error.message})});
  return()=>{live=false;if(current.current===key)current.current=null};
 },[key]);
 const data=result.key===key?result.data:null,error=mutation.key===key&&mutation.error?mutation.error:result.key===key?result.error:'';
 async function save(pairs:ReaderPair[]){
  if(!data||pending.current===key)return null;
  pending.current=key;setMutation({key,busy:true,error:''});
  try{
   const saved=await requestJson<ReaderPairSettings>(route,{...options,method:'PUT',headers:{...options.headers,'Content-Type':'application/json'},body:JSON.stringify({revision:data.revision,pairs})});
   if(current.current!==key)return null;
   setResult({key,data:saved,error:''});setMutation({key,busy:false,error:''});return saved;
  }catch(error){if(current.current===key)setMutation({key,busy:false,error:(error as Error).message});return null}
  finally{if(pending.current===key)pending.current=null}
 }
 return {data,error,loading:result.key!==key,busy:mutation.key===key&&mutation.busy,save,refresh:()=>setAttempt(n=>n+1)};
}
