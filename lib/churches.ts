import {z} from 'zod';
import {db,digest,fail,isOwner} from './server';
import type {Church,Profile} from './types';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
export const LEGACY_CHURCH='uelin';
export async function ensureChurches(){
 const done=await db().prepare('SELECT id FROM settings WHERE id=?').bind('church-migration-v1').first();if(done)return;
 // Schema defaults preserve all historic records. This idempotent data copy
 // carries existing team access across without requiring anyone to rejoin.
 await db().batch([
  db().prepare("INSERT OR IGNORE INTO churches (id,name,created_by,active,created) VALUES (?,'유엘인교회 찬양팀','legacy',1,?)").bind(LEGACY_CHURCH,Date.now()),
  db().prepare("INSERT OR IGNORE INTO memberships (church_id,user_id,role,position,active,leader_requested,created) SELECT ?,id,role,position,active,0,created FROM profiles WHERE legacy_church=?").bind(LEGACY_CHURCH,LEGACY_CHURCH),
  db().prepare("UPDATE churches SET invite_hash=(SELECT value FROM settings WHERE id='invite') WHERE id=? AND invite_hash IS NULL").bind(LEGACY_CHURCH),
  db().prepare("INSERT OR IGNORE INTO settings (id,value) VALUES ('church-migration-v1','done')")
 ]);
}
export function requestedChurch(req:Request){const header=req.headers.get('x-church-id');if(header)return header;const url=new URL(req.url);if(url.pathname.startsWith('/api/files/')&&url.searchParams.get('church'))return url.searchParams.get('church')!;const cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('praise_church='));return cookie?decodeURIComponent(cookie.slice(14)):'';}
export function churchResponse(id:string){return Response.json({ok:true,churchId:id},{headers:{'Cache-Control':'no-store','Set-Cookie':`praise_church=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=31536000`}});}
export async function churchList(user:ChatGPTUser,trash=false):Promise<Church[]>{
 if(trash&&!isOwner(user.email))fail(403,'교회 휴지통은 총관리자만 확인할 수 있습니다.');
 if(isOwner(user.email)){const r=await db().prepare("SELECT c.id,c.name,c.active,c.deleted_at AS deletedAt, 'admin' AS role, (SELECT count(*) FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.church_id=c.id AND m.active=1 AND p.active=1) AS memberCount,(SELECT count(*) FROM services s WHERE s.church_id=c.id AND s.deleted=0) AS serviceCount,(SELECT group_concat(p.name, ', ') FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.church_id=c.id AND m.active=1 AND m.role='admin') AS leaders FROM churches c WHERE c.deleted_at IS "+(trash?'NOT NULL ORDER BY c.deleted_at DESC,c.id':'NULL ORDER BY c.created,c.id')).all<Church>();return r.results;}
 const r=await db().prepare('SELECT c.id,c.name,c.active,m.role,m.leader_requested AS leaderRequested FROM churches c JOIN memberships m ON m.church_id=c.id WHERE m.user_id=? AND m.active=1 AND c.deleted_at IS NULL ORDER BY c.created,c.id').bind(user.userId).all<Church>();return r.results;
}
export async function churchContext(req:Request,user:ChatGPTUser,optional=false):Promise<{profile:Profile|null;church:Church|null;churches:Church[];account:Profile|null}>{
 await ensureChurches();const account=await db().prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first<Profile>();const churches=account?.active?await churchList(user):[];
 if(!account?.active){if(!optional)fail(403,'이름과 교회 가입 상태를 확인해 주세요.');return {profile:null,church:null,churches,account};}
 const desired=requestedChurch(req),id=desired||(isOwner(user.email)?churches.find(c=>c.id===LEGACY_CHURCH)?.id||churches[0]?.id:churches.find(c=>c.active)?.id);
 let church=churches.find(c=>c.id===id);
 // Only /me may choose a replacement for the owner's deleted selection.
 // Resource requests with an explicit deleted church must never switch tenants.
 if(!church&&optional&&isOwner(user.email))church=churches.find(c=>c.active)||churches[0];
 if(!church||(!church.active&&!isOwner(user.email))){if(!optional)fail(403,'이 교회에 접근할 권한이 없거나 운영이 중지되었습니다.');return {profile:null,church:null,churches,account};}
 const membership=await db().prepare('SELECT * FROM memberships WHERE church_id=? AND user_id=? AND active=1').bind(church.id,user.userId).first<any>();
 return {account,church,churches,profile:{...account,role:isOwner(user.email)?'admin':membership.role,position:membership?.position||'인도자',churchId:church.id,superAdmin:isOwner(user.email),leaderRequested:membership?.leader_requested||0}};
}
export const churchName=z.string().trim().min(2,'교회 이름을 입력해 주세요.').max(80);
export async function findInvite(code:string){if(!code)fail(403,'교회 초대 코드를 입력해 주세요.');const church=await db().prepare('SELECT * FROM churches WHERE invite_hash=? AND active=1 AND deleted_at IS NULL').bind(await digest(code)).first<Church>();if(!church)fail(403,'교회 초대 코드를 확인해 주세요.');return church!;}
