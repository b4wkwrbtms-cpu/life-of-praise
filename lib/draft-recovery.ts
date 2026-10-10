import type {Service,Worship} from './types';

export type DraftScope={userId:string;churchId:string;serviceId:string};
export type DraftBackup={format:1;id:string;updated:number;revision:number;base:Worship;data:Worship};
type Store=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
const MAX_RECORD_CHARS=2_000_000;
// A separate record per editor instance prevents one tab from deleting another tab's work.
export const draftPrefix=(scope:DraftScope)=>'praise-draft-v1:'+JSON.stringify([scope.userId,scope.churchId,scope.serviceId])+':';
export function sameDraft(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a).filter(k=>(a as any)[k]!==undefined),bk=Object.keys(b).filter(k=>(b as any)[k]!==undefined);
 return ak.length===bk.length&&ak.every(k=>Object.prototype.hasOwnProperty.call(b,k)&&sameDraft((a as any)[k],(b as any)[k]));
}
const strings=(value:any,keys:string[])=>!!value&&keys.every(k=>typeof value[k]==='string');
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const layout=(v:any)=>v&&['x','y','size','width'].every(k=>finite(v[k]))&&typeof v.margin==='boolean';
// Backups may contain unfinished text (including an empty title or URL), so they
// intentionally do not use the stricter publication/server validation schema.
export function isDraft(value:any):value is Worship{
 return strings(value,['title','date','passage','translation','scripture','theme','rehearsal','notice'])&&Array.isArray(value.songs)&&value.songs.length<=30&&value.songs.every((s:any)=>
  strings(s,['id','title','key','bpm','notes','transition','link'])&&layout(s.layout)&&s.parts&&typeof s.parts==='object'&&Object.values(s.parts).every(v=>typeof v==='string')&&
  Array.isArray(s.form)&&s.form.length<=100&&s.form.every((f:any)=>strings(f,['id','type']))&&
  Array.isArray(s.pages)&&s.pages.length<=30&&s.pages.every((p:any)=>strings(p,['id'])&&finite(p.width)&&p.width>0&&finite(p.height)&&p.height>0&&(!p.layout||layout(p.layout)))&&
  Array.isArray(s.exports)&&s.exports.every((id:any)=>typeof id==='string')&&
  (s.markers===undefined||Array.isArray(s.markers)&&s.markers.length<=200&&s.markers.every((m:any)=>strings(m,['id','pageId','type'])&&finite(m.y)&&finite(m.size)&&(m.x===undefined||finite(m.x)))));
}
export function readDraftBackups(store:Store,scope:DraftScope,current:Worship):DraftBackup[]{
 const prefix=draftPrefix(scope),result:DraftBackup[]=[];
 const keys=Array.from({length:store.length},(_,i)=>store.key(i)).filter((key):key is string=>!!key?.startsWith(prefix));
 for(const key of keys){
  try{const text=store.getItem(key);if(!text||text.length>MAX_RECORD_CHARS)continue;const r=JSON.parse(text);
   if(r.format===1&&typeof r.id==='string'&&key===prefix+r.id&&finite(r.updated)&&Number.isInteger(r.revision)&&r.revision>0&&isDraft(r.base)&&isDraft(r.data)){
    if(sameDraft(r.data,current)){if(store.getItem(key)===text)store.removeItem(key)}else result.push(r);
   }
  }catch{/* A damaged record must not stop opening the editor. */}
 }
 return result.sort((a,b)=>b.updated-a.updated);
}
export function writeDraftBackup(store:Store,scope:DraftScope,backup:DraftBackup){
 const text=JSON.stringify(backup);if(text.length>MAX_RECORD_CHARS)throw new Error('복구용 편집 내용이 너무 큽니다.');
 store.setItem(draftPrefix(scope)+backup.id,text);
}
export function removeDraftBackup(store:Store,scope:DraftScope,id:string){store.removeItem(draftPrefix(scope)+id)}

export type SavePhase='saved'|'pending'|'saving'|'offline'|'error'|'conflict';
export type DraftSaveState={phase:SavePhase;error:string;backup:boolean};
type Options={data:Worship;revision:number;forcePending?:boolean;online:()=>boolean;write:(data:Worship,revision:number)=>Promise<{revision:number}>;checkpoint:(data:Worship,base:Worship,revision:number,dirty:boolean)=>boolean;changed:(state:DraftSaveState)=>void};
export class DraftSaveQueue{
 current:Worship; base:Worship; revision:number;
 state:DraftSaveState={phase:'saved',error:'',backup:false};
 private forcePending:boolean;private pending:Promise<void>|null=null;private inFlight:Worship|null=null;private conflict:Error|null=null;private options:Options;
 constructor(options:Options){this.options=options;this.current=structuredClone(options.data);this.base=structuredClone(options.data);this.revision=options.revision;this.forcePending=!!options.forcePending;if(this.forcePending)this.state.phase='pending'}
 get dirty(){return this.forcePending||!sameDraft(this.current,this.base)||!!this.inFlight&&!sameDraft(this.current,this.inFlight)}
 checkpoint(){const backup=this.options.checkpoint(this.current,this.base,this.revision,this.dirty);this.state={...this.state,backup};this.options.changed(this.state);return backup}
 private report(phase:SavePhase,error=''){this.state={...this.state,phase,error};this.checkpoint()}
 update(data:Worship){this.current=structuredClone(data);this.report(this.conflict?'conflict':this.pending?'saving':this.dirty?'pending':'saved',this.conflict?.message||'')}
 flush():Promise<void>{
  if(this.pending)return this.pending;
  if(this.conflict)return Promise.reject(this.conflict);
  // Start in a microtask so synchronous edits see the same in-flight promise.
  this.pending=Promise.resolve().then(async()=>{
   while(this.dirty){
    if(!this.options.online())throw Object.assign(new Error('인터넷 연결을 기다리고 있습니다.'),{status:0});
    const snapshot=structuredClone(this.current);this.inFlight=snapshot;this.report('saving');
    const result=await this.options.write(snapshot,this.revision);
    if(!Number.isInteger(result.revision)||result.revision<=this.revision)throw new Error('저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
    this.revision=result.revision;this.base=snapshot;this.forcePending=false;this.inFlight=null;
    // A newer edit remains in the backup and is saved next, never labelled saved early.
    this.report(this.dirty?'saving':'saved');
   }
   this.report('saved');
  }).catch(error=>{
   const status=(error as any)?.status;
   // If an edit was reverted during a request whose result is unknown, preserve
   // that reversion too: the server may have accepted the in-flight snapshot.
   if(this.inFlight)this.forcePending=true;this.inFlight=null;
   if(status===409)this.conflict=error;
   this.report(status===409?'conflict':status===0?'offline':'error',error instanceof Error?error.message:'저장하지 못했습니다.');
   throw error;
  }).finally(()=>{this.pending=null});
  return this.pending;
 }
}

type DraftRequest=<T=any>(path:string,method?:string,body?:unknown)=>Promise<T>;
export async function saveDraftWithReconciliation(request:DraftRequest,serviceId:string,snapshot:Worship,revision:number):Promise<{revision:number}>{
 try{return await request(`services/${serviceId}`,'PUT',{revision,data:snapshot})}catch(error){
  // Never automatically overwrite a different draft to resolve a conflict.
  if((error as any)?.status===409){try{const rows=await request<Service[]>('services'),fresh=rows.find(row=>row.id===serviceId);if(fresh?.draft&&fresh.revision>revision&&sameDraft(fresh.draft,snapshot))return {revision:fresh.revision}}catch{}}
  throw error;
 }
}

export function saveStateText(state:DraftSaveState){
 if(state.phase==='saved')return '서버에 저장됨';
 if(state.phase==='saving')return '변경 내용 저장 중…';
 if(state.phase==='conflict')return '다른 창의 변경 확인 필요';
 if(state.phase==='offline')return state.backup?'기기에 보관됨 · 연결 대기':'인터넷 연결 필요 · 미저장';
 if(state.phase==='error')return state.backup?'기기에 보관됨 · 저장 재시도 필요':'저장 실패 · 창을 유지해 주세요';
 return state.backup?'기기에 보관됨 · 서버 저장 대기':'변경 내용 저장 대기';
}
