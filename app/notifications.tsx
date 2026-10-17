'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,BellRing,Check,ChevronRight,Loader2,Smartphone,X} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {requestJson} from '@/lib/api-response';
import {devicePlatform,standalone} from './app-guide';
import {toast} from 'sonner';
export type WorshipNotice={id:string;serviceId:string;churchId:string;title:string;date:string;created:number;readAt:number|null};
type Inbox={items:WorshipNotice[];unread:number;publicKey:string|null};
type Support='checking'|'ready'|'install'|'unsupported'|'denied';
const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const keyEqual=(a:ArrayBuffer|null|undefined,b:string)=>!!a&&Array.from(new Uint8Array(a)).join(',')===Array.from(decode(b)).join(',');
export function useWorshipNotifications(userId:string,churchId:string){
 const [inbox,setInbox]=useState<Inbox>({items:[],unread:0,publicKey:null}),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[support,setSupport]=useState<Support>('checking'),[enabled,setEnabled]=useState(false),[dismissed,setDismissed]=useState(true),[loaded,setLoaded]=useState(false);
 const registration=useRef<Promise<ServiceWorkerRegistration>|null>(null),subscription=useRef<PushSubscription|null>(null),alive=useRef(false),refreshTicket=useRef(0);
 const storageKey='praise-notification-prompt:'+userId+':'+churchId;
 const call=useCallback(<T=any,>(path:string,method='GET',body?:unknown)=>requestJson<T>('/api/notifications'+path,{method,headers:{'X-Church-Id':churchId,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'}),[churchId]);
 const refresh=useCallback(async()=>{
 if(!userId||!churchId)return;const ticket=++refreshTicket.current;
 try{const data=await call<Inbox>('');if(!alive.current||ticket!==refreshTicket.current)return;setInbox(data);setLoaded(true);setError('');
 if(devicePlatform()==='ios'&&!standalone()){setSupport('install');setEnabled(false);return;}
 if(!window.isSecureContext||!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window)){setSupport('unsupported');setEnabled(false);return;}
 setSupport(Notification.permission==='denied'?'denied':'ready');
 if(!registration.current)registration.current=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).catch(e=>{registration.current=null;throw e});
 const reg=await registration.current,sub=await reg.pushManager.getSubscription();
 const state=sub?await call<{enabled:boolean}>('/device','POST',{endpoint:sub.endpoint}):{enabled:false};
 if(!alive.current||ticket!==refreshTicket.current)return;subscription.current=sub;
 setEnabled(!!sub&&state.enabled&&Notification.permission==='granted'&&!!data.publicKey&&keyEqual(sub.options.applicationServerKey,data.publicKey));
 }catch(e){if(alive.current&&ticket===refreshTicket.current)setError((e as Error).message);}
 },[userId,churchId,call]);
 useEffect(()=>{
 alive.current=true;setInbox({items:[],unread:0,publicKey:null});setEnabled(false);setLoaded(false);setOpen(false);setError('');subscription.current=null;
 try{setDismissed(Number(localStorage.getItem(storageKey)||0)>Date.now())}catch{setDismissed(false)}
 refresh();const focus=()=>{if(document.visibilityState==='visible'&&navigator.onLine)refresh()};
 const interval=setInterval(focus,45000);window.addEventListener('focus',focus);window.addEventListener('online',focus);document.addEventListener('visibilitychange',focus);
 return()=>{alive.current=false;++refreshTicket.current;clearInterval(interval);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);document.removeEventListener('visibilitychange',focus)};
 },[refresh,storageKey]);
 const dismiss=()=>{try{localStorage.setItem(storageKey,String(Date.now()+7*86400000))}catch{}setDismissed(true)};
 const enable=async()=>{
 if(busy)return;setBusy(true);setError('');
 try{
 if(support!=='ready')throw new Error('아래 기기별 안내를 확인해 주세요.');
 if(!inbox.publicKey)throw new Error('휴대폰 알림을 준비 중입니다. 앱 알림함은 이용할 수 있어요.');
 // Permission must be requested directly from the button's user gesture on iOS.
 const permission=await Notification.requestPermission();
 if(permission!=='granted'){setSupport(permission==='denied'?'denied':'ready');throw new Error(permission==='denied'?'알림이 차단되어 있어요. 기기 설정에서 허용한 뒤 다시 켜 주세요.':'알림 허용을 선택하면 새 콘티를 알려드릴게요.');}
 if(!registration.current)registration.current=navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready);
 const reg=await registration.current;let sub=await reg.pushManager.getSubscription();
 if(sub&&!keyEqual(sub.options.applicationServerKey,inbox.publicKey)){await sub.unsubscribe();sub=null;}
 sub=sub??await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(inbox.publicKey)});
 const serialized=sub.toJSON();await call('/subscribe','POST',{endpoint:sub.endpoint,keys:serialized.keys});
 subscription.current=sub;if(alive.current){setEnabled(true);toast.success('이 기기에서 새 콘티 알림을 받을 수 있어요.');}
 }catch(e){if(alive.current)setError((e as Error).message)}finally{if(alive.current)setBusy(false)}
 };
 const disable=async()=>{if(busy)return;setBusy(true);setError('');try{const sub=subscription.current;if(sub)await call('/subscribe','DELETE',{endpoint:sub.endpoint});setEnabled(false);toast.success('이 기기의 현재 교회 알림을 껐습니다.');}catch(e){setError((e as Error).message)}finally{setBusy(false)}};
 const test=async()=>{if(busy||!subscription.current)return;setBusy(true);setError('');try{await call('/test','POST',{endpoint:subscription.current.endpoint});toast.success('테스트 알림을 보냈어요. 기기 알림함을 확인해 주세요.');}catch(e){if((e as {status?:number}).status===410)setEnabled(false);setError((e as Error).message)}finally{setBusy(false)}};
 const read=async(id?:string)=>{try{await call('/read','POST',id?{id}:{});await refresh()}catch(e){toast.error((e as Error).message)}};
 const logout=()=>{const sub=subscription.current;if(sub)void Promise.allSettled([requestJson('/api/notification-device',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint}),keepalive:true}),sub.unsubscribe()]);};
 return {logout,inbox,open,setOpen,busy,error,support,enabled,dismissed,loaded,dismiss,enable,disable,test,read,refresh,available:!!userId&&!!churchId};
}
export type NoticeModel=ReturnType<typeof useWorshipNotifications>;
export function NotificationBell({model:m}:{model:NoticeModel}){return m.available?<button className="notice-bell" aria-label={`알림함${m.inbox.unread?`, 읽지 않은 알림 ${m.inbox.unread}개`:''}`} onClick={()=>{m.setOpen(true);m.refresh()}}><Bell size={21}/>{m.inbox.unread>0&&<span className="notice-badge">{m.inbox.unread>99?'99+':m.inbox.unread}</span>}</button>:null;}
export function NotificationPrompt({model:m}:{model:NoticeModel}){if(!m.available||!m.loaded||m.enabled||m.dismissed)return null;return <aside className="notice-prompt"><span className="notice-prompt-icon"><BellRing size={20}/></span><div><strong>새 콘티, 알림으로 받아보세요</strong><p>인도자가 예배 콘티를 공개하면 알려드려요.</p></div><button className="secondary" onClick={()=>m.setOpen(true)}>알림 설정</button><button className="notice-dismiss" aria-label="알림 안내 일주일간 닫기" onClick={m.dismiss}><X size={17}/></button></aside>;}
export function NotificationSettings({model:m}:{model:NoticeModel}){return <button className="notice-settings-link panel" onClick={()=>{m.setOpen(true);m.refresh()}}><span className="notice-prompt-icon"><Bell size={21}/></span><span><strong>콘티 알림</strong><small>{m.enabled?'이 기기의 새 콘티 알림이 켜져 있어요':'기기별 알림 설정 · 지난 알림 확인'}</small></span><ChevronRight size={19}/></button>;}
export function NotificationDialog({model:m,onOpen,onInstall,churchName}:{model:NoticeModel;onOpen:(notice:WorshipNotice)=>void;onInstall:()=>void;churchName:string}){return <Dialog open={m.open} onOpenChange={m.setOpen}><DialogContent className="notice-dialog"><DialogTitle>알림함</DialogTitle><DialogDescription>{churchName}의 새로운 예배 소식</DialogDescription><div className="notice-dialog-scroll">
 <section className="notice-device"><div className="notice-device-heading"><Smartphone size={18}/><strong>이 기기의 콘티 알림</strong><span className={'notice-state '+(m.enabled?'is-on':'')}>{m.enabled?'켜짐':'꺼짐'}</span></div>
 <p>콘티를 처음 공개할 때 한 번 알려드려요. 앱 알림함은 알림 허용 없이도 볼 수 있어요.</p>
 {m.support==='install'?<><p className="notice-help">아이폰·아이패드는 Safari에서 이 앱을 홈 화면에 추가한 뒤, 홈 화면 아이콘으로 열어 알림을 켜 주세요.</p><button className="secondary" onClick={()=>{m.setOpen(false);onInstall()}}>아이폰 설치 안내 <ChevronRight size={16}/></button></>:m.support==='unsupported'?<><p className="notice-help">현재 브라우저에서는 기기 알림을 지원하지 않아요. 최신 Safari·Chrome·Edge 또는 설치한 앱에서 열어 주세요.</p><button className="secondary" onClick={()=>{m.setOpen(false);onInstall()}}>설치 안내 보기</button></>:m.support==='denied'?<p className="notice-help">알림이 차단되어 있어요. 아이폰은 설정 → 알림 → 생명의 찬양, 안드로이드·컴퓨터는 브라우저의 이 사이트 알림 설정에서 허용한 뒤 다시 열어 주세요.</p>:<div className="notice-device-actions">{m.enabled?<><button className="secondary" disabled={m.busy} onClick={m.test}>{m.busy?<Loader2 className="spin" size={16}/>:<BellRing size={16}/>}테스트 알림</button><button className="text-button" disabled={m.busy} onClick={m.disable}>알림 끄기</button></>:<button className="primary" disabled={m.busy||!m.inbox.publicKey||m.support==='checking'} onClick={m.enable}>{m.busy?<Loader2 className="spin" size={17}/>:<Bell size={17}/>}콘티 알림 켜기</button>}</div>}
 {m.loaded&&!m.inbox.publicKey&&<p className="notice-help">휴대폰 알림을 준비 중이에요. 새 콘티는 아래 알림함에서 확인할 수 있습니다.</p>}
 {m.error&&<p role="alert" className="notice-error">{m.error} <button className="text-button" onClick={m.refresh}>다시 확인</button></p>}
 <small>기기와 교회별 설정입니다. 다른 기기에서도 각각 켜 주세요.</small></section>
 <div className="notice-list-heading"><h3>최근 알림</h3>{m.inbox.unread>0&&<button className="text-button" onClick={()=>m.read()}><Check size={15}/>모두 읽음</button>}</div>
 {!m.loaded?<p className="notice-empty" role="status">알림을 불러오는 중…</p>:m.inbox.items.length?<ol className="notice-list">{m.inbox.items.map(n=><li key={n.id}><button className={!n.readAt?'is-unread':''} onClick={()=>{m.setOpen(false);onOpen(n)}}><span className="notice-dot"/><span><strong>예배 콘티가 올라왔어요</strong><span>{n.date} · {n.title}</span><small>{new Date(n.created).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></span><ChevronRight size={17}/></button></li>)}</ol>:<div className="notice-empty"><Bell size={28}/><strong>새 콘티가 올라오면 여기에 모여요</strong><p>기존 팀원도 다음 공개부터 알림을 받을 수 있어요.</p></div>}
 </div></DialogContent></Dialog>}
