import {waitUntil} from 'cloudflare:workers';
import {z} from 'zod';
import {bindings,db,digest,fail,json} from './server';
import {sendPush,validatePushKeys,validPushEndpoint,type VapidConfig} from './web-push';
import type {Profile} from './types';
const id=z.string().min(1).max(100);
const deviceBody=z.object({endpoint:z.string().max(2048)}).strict();
function config():VapidConfig|null{const b=bindings();return b.WEB_PUSH_PUBLIC_KEY&&b.WEB_PUSH_PRIVATE_JWK&&b.WEB_PUSH_SUBJECT?{publicKey:b.WEB_PUSH_PUBLIC_KEY,privateJwk:b.WEB_PUSH_PRIVATE_JWK,subject:b.WEB_PUSH_SUBJECT}:null;}
// Appended to the publish transaction, after its revision-guarded UPDATE.
// The event UUID prevents a losing concurrent publish from enrolling recipients.
export function publicationNotices(serviceId:string,churchId:string,revision:number,title:string,date:string,now:number){
 const notice=crypto.randomUUID();
 return [
 db().prepare('INSERT OR IGNORE INTO worship_notices (id,service_id,church_id,title,date,created) SELECT ?,id,church_id,?,?,? FROM services WHERE id=? AND church_id=? AND version=1 AND revision=? AND deleted=0 AND published IS NOT NULL').bind(notice,title,date,now,serviceId,churchId,revision),
 db().prepare('INSERT OR IGNORE INTO notice_receipts (notice_id,user_id) SELECT n.id,m.user_id FROM worship_notices n JOIN memberships m ON m.church_id=n.church_id AND m.active=1 JOIN profiles p ON p.id=m.user_id AND p.active=1 JOIN churches c ON c.id=n.church_id AND c.active=1 AND c.deleted_at IS NULL WHERE n.id=?').bind(notice),
 db().prepare("INSERT OR IGNORE INTO push_deliveries (notice_id,subscription_id,user_id,state,attempts,next_at) SELECT r.notice_id,s.id,r.user_id,'pending',0,? FROM notice_receipts r JOIN worship_notices n ON n.id=r.notice_id JOIN push_channels ch ON ch.church_id=n.church_id AND ch.user_id=r.user_id JOIN push_subscriptions s ON s.id=ch.subscription_id AND s.user_id=r.user_id WHERE n.id=?").bind(now,notice)
 ];
}
const visible=`FROM worship_notices n JOIN notice_receipts r ON r.notice_id=n.id JOIN services s ON s.id=n.service_id AND s.deleted=0 AND s.published IS NOT NULL JOIN churches c ON c.id=n.church_id AND c.active=1 AND c.deleted_at IS NULL JOIN memberships m ON m.church_id=n.church_id AND m.user_id=r.user_id AND m.active=1 JOIN profiles p ON p.id=r.user_id AND p.active=1`;
// Used before selecting a church, for an OS notification deep link. Membership
// and receipt ownership are checked independently of the selected church.
export async function resolveNotice(notice:string,userId:string){
 const row=await db().prepare(`SELECT n.id,n.service_id AS serviceId,n.church_id AS churchId,n.title,n.date,n.created,r.read_at AS readAt ${visible} WHERE n.id=? AND r.user_id=?`).bind(notice,userId).first();
 if(!row)fail(404,'이 알림의 예배가 삭제되었거나 접근할 수 없습니다.');return row;
}
export async function forgetPushDevice(endpoint:string,userId:string){
 await db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=?').bind(await digest(endpoint),userId).run();
}
export function schedulePush(churchId:string){
 if(!config())return;
 waitUntil(drainPush(churchId).catch(()=>console.error('Push delivery deferred; inbox retained')));
}
export async function drainPush(churchId:string){
 const cfg=config();if(!cfg)return;
 const deadline=Date.now()+20000;
 // Persist before sending. A lease recovers work interrupted by the runtime.
 while(Date.now()<deadline){
 const now=Date.now();
 const jobs=await db().prepare("SELECT d.notice_id,d.subscription_id,d.user_id,d.attempts FROM push_deliveries d JOIN worship_notices n ON n.id=d.notice_id WHERE n.church_id=? AND d.state IN ('pending','sending') AND d.next_at<=? ORDER BY d.next_at LIMIT 12").bind(churchId,now).all<{notice_id:string;subscription_id:string;user_id:string;attempts:number}>();
 if(!jobs.results.length)return;
 await Promise.all(jobs.results.map(async job=>{
 const lease=crypto.randomUUID();
 const claimed=await db().prepare("UPDATE push_deliveries SET state='sending',lease=?,next_at=?,attempts=attempts+1 WHERE notice_id=? AND subscription_id=? AND state IN ('pending','sending') AND next_at<=?").bind(lease,now+120000,job.notice_id,job.subscription_id,now).run();if(!claimed.meta.changes)return;
 const delivery=await db().prepare(`SELECT n.id,n.title,n.date,c.name AS churchName,su.endpoint,su.p256dh,su.auth,su.updated ${visible} JOIN push_channels ch ON ch.church_id=n.church_id AND ch.user_id=r.user_id JOIN push_subscriptions su ON su.id=ch.subscription_id AND su.user_id=r.user_id WHERE n.id=? AND r.user_id=? AND su.id=? AND n.created>? AND r.read_at IS NULL`).bind(job.notice_id,job.user_id,job.subscription_id,Date.now()-86400000).first<any>();
 if(!delivery){await db().prepare("UPDATE push_deliveries SET state='cancelled',lease=NULL WHERE notice_id=? AND subscription_id=? AND lease=?").bind(job.notice_id,job.subscription_id,lease).run();return;}
 let result={status:0,retryAfter:0};
 try{result=await sendPush(delivery.endpoint,{p256dh:delivery.p256dh,auth:delivery.auth},{title:'예배 콘티가 올라왔어요',body:`${delivery.churchName} · ${delivery.date}\n${delivery.title}`,noticeId:delivery.id},cfg,delivery.id);}catch{/* Network failure: retry from the persisted outbox. Never log subscription secrets. */}
 if(result.status===404||result.status===410){await db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=? AND endpoint=? AND updated=?').bind(job.subscription_id,job.user_id,delivery.endpoint,delivery.updated).run();return;}
 const ok=result.status>=200&&result.status<300,retry=!ok&&(result.status===0||result.status===429||result.status>=500)&&job.attempts<4;
 await db().prepare('UPDATE push_deliveries SET state=?,next_at=?,lease=NULL,last_status=? WHERE notice_id=? AND subscription_id=? AND lease=?').bind(ok?'sent':retry?'pending':'failed',Date.now()+Math.max(result.retryAfter,Math.min(3600000,30000*2**job.attempts)),result.status,job.notice_id,job.subscription_id,lease).run();
 }));
 }
}
export async function notificationsApi(req:Request,path:string[],p:Profile,read:()=>Promise<unknown>){
 const method=req.method,church=p.churchId!;
 if(path.length===1&&method==='GET'){
 const rows=await db().prepare(`SELECT n.id,n.service_id AS serviceId,n.church_id AS churchId,n.title,n.date,n.created,r.read_at AS readAt ${visible} WHERE r.user_id=? AND n.church_id=? ORDER BY n.created DESC LIMIT 60`).bind(p.id,church).all();
 const count=await db().prepare(`SELECT count(*) AS count ${visible} WHERE r.user_id=? AND n.church_id=? AND r.read_at IS NULL`).bind(p.id,church).first<{count:number}>();
 schedulePush(church);return json({items:rows.results,unread:count?.count||0,publicKey:config()?.publicKey||null});
 }
 if(path[1]==='read'&&method==='POST'){
 const v=z.object({id:id.optional()}).strict().parse(await read());
 await db().prepare(`UPDATE notice_receipts SET read_at=? WHERE user_id=? AND read_at IS NULL AND notice_id IN (SELECT id FROM worship_notices WHERE church_id=? ${v.id?'AND id=?':''})`).bind(Date.now(),p.id,church,...(v.id?[v.id]:[])).run();return json({ok:true});
 }
 if(path[1]==='device'&&method==='POST'){
 const {endpoint}=deviceBody.parse(await read());const key=await digest(endpoint);
 const channel=await db().prepare('SELECT s.id FROM push_subscriptions s JOIN push_channels c ON c.subscription_id=s.id AND c.user_id=s.user_id WHERE s.id=? AND s.user_id=? AND c.church_id=?').bind(key,p.id,church).first();return json({enabled:!!channel});
 }
 if(path[1]==='subscribe'&&method==='POST'){
 if(!config())fail(503,'휴대폰 알림을 준비 중입니다. 앱 알림함은 바로 이용할 수 있어요.');
 const v=z.object({endpoint:z.string().max(2048),keys:z.object({p256dh:z.string().max(100),auth:z.string().max(30)}).strict()}).strict().parse(await read());
 if(!validPushEndpoint(v.endpoint))fail(400,'이 브라우저의 알림 주소를 확인할 수 없습니다.');
 try{await validatePushKeys(v.keys)}catch{fail(400,'알림 등록 정보를 다시 받아 주세요.');}
 const key=await digest(v.endpoint),now=Date.now();
 const count=await db().prepare('SELECT count(*) AS n FROM push_subscriptions WHERE user_id=? AND id<>?').bind(p.id,key).first<{n:number}>();if((count?.n||0)>=20)fail(400,'등록된 기기가 너무 많습니다. 사용하지 않는 기기의 알림을 꺼 주세요.');
 // A browser endpoint belongs to one signed-in account. Explicit opt-in can
 // rebind it; old accounts/churches must not retain that endpoint.
 await db().batch([
 db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id<>?').bind(key,p.id),
 db().prepare('INSERT INTO push_subscriptions (id,user_id,endpoint,p256dh,auth,created,updated,test_at) VALUES (?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated=excluded.updated').bind(key,p.id,v.endpoint,v.keys.p256dh,v.keys.auth,now,now),
 db().prepare('INSERT OR IGNORE INTO push_channels (subscription_id,church_id,user_id) VALUES (?,?,?)').bind(key,church,p.id)
 ]);return json({ok:true});
 }
 if(path[1]==='subscribe'&&method==='DELETE'){
 const v=deviceBody.parse(await read()),key=await digest(v.endpoint);
 await db().batch([db().prepare('DELETE FROM push_channels WHERE subscription_id=? AND user_id=? AND church_id=?').bind(key,p.id,church),db().prepare("UPDATE push_deliveries SET state='cancelled' WHERE subscription_id=? AND user_id=? AND notice_id IN (SELECT id FROM worship_notices WHERE church_id=?) AND state IN ('pending','sending')").bind(key,p.id,church),db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=? AND NOT EXISTS (SELECT 1 FROM push_channels WHERE subscription_id=?)').bind(key,p.id,key)]);return json({ok:true});
 }
 if(path[1]==='test'&&method==='POST'){
 const cfg=config();if(!cfg)fail(503,'휴대폰 알림을 준비 중입니다.');const v=deviceBody.parse(await read()),key=await digest(v.endpoint);
 const device=await db().prepare('SELECT s.* FROM push_subscriptions s JOIN push_channels c ON c.subscription_id=s.id AND c.user_id=s.user_id WHERE s.id=? AND s.user_id=? AND c.church_id=?').bind(key,p.id,church).first<any>();if(!device)fail(400,'먼저 이 기기의 콘티 알림을 켜 주세요.');
 const r=await db().prepare('UPDATE push_subscriptions SET test_at=? WHERE id=? AND user_id=? AND test_at<?').bind(Date.now(),key,p.id,Date.now()-60000).run();if(!r.meta.changes)fail(429,'테스트 알림은 1분 뒤 다시 보낼 수 있습니다.');
 let status=0;try{status=(await sendPush(device.endpoint,device,{title:'콘티 알림이 켜졌어요',body:'새 예배 콘티가 공개되면 이 기기로 알려드릴게요.'},cfg!,'praise-device-test')).status}catch{}
 if(status===404||status===410){await db().prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=?').bind(key,p.id).run();fail(410,'알림 연결이 만료되었습니다. 다시 켜 주세요.');}
 if(status<200||status>=300)fail(502,'테스트 알림을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');return json({ok:true});
 }
 fail(404,'알림 요청을 찾을 수 없습니다.');
}
