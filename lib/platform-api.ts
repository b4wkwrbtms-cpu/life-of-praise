import {z} from 'zod';
import {db,digest,fail,isOwner,json} from './server';
import {churchName,ensureChurches} from './churches';
import type {ChatGPTUser} from '@/app/chatgpt-auth';

export async function myApplications(id:string){return (await db().prepare('SELECT id,user_id,name,church_name,status,church_id,reason,created,reviewed FROM church_applications WHERE user_id=? ORDER BY created DESC').bind(id).all()).results;}

export async function platformApi(req:Request,path:string[],user:ChatGPTUser,read:()=>Promise<any>):Promise<Response|null>{
 if(!['platform','church-applications'].includes(path[0]))return null;
 await ensureChurches();
 const account=await db().prepare('SELECT active FROM profiles WHERE id=?').bind(user.userId).first<any>();
 if(account&&!account.active)fail(403,'계정 접근이 중지되었습니다.');
 const owner=isOwner(user.email),method=req.method;
 if(path[0]==='church-applications'){
  if(method==='GET')return json(await myApplications(user.userId));
  if(method!=='POST'||path.length!==1)fail(405,'지원하지 않는 요청입니다.');
  const v=z.object({name:z.string().trim().min(1).max(40),churchName,leaderCode:z.string().trim().min(1).max(100)}).parse(await read());
  const now=Date.now(),invite=await db().prepare('SELECT id FROM leader_invites WHERE code_hash=? AND active=1 AND expires>? AND claimed_by IS NULL').bind(await digest(v.leaderCode),now).first<any>();
  if(!invite)fail(403,'사용 가능한 인도자 초대 코드가 아닙니다. 총관리자에게 코드를 받아 주세요.');
  if(await db().prepare("SELECT id FROM church_applications WHERE user_id=? AND status='pending'").bind(user.userId).first())fail(409,'이미 승인 대기 중인 신청이 있습니다.');
  const id=crypto.randomUUID();
  const results=await db().batch([
   db().prepare("INSERT INTO profiles (id,name,position,role,active,created,legacy_church) VALUES (?,?,'인도자','member',1,?,NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name").bind(user.userId,v.name,now),
   db().prepare("INSERT OR IGNORE INTO church_applications (id,user_id,invite_id,name,church_name,status,reason,created) SELECT ?,?,?,?,?,'pending','',? FROM leader_invites WHERE id=? AND active=1 AND expires>? AND claimed_by IS NULL").bind(id,user.userId,invite!.id,v.name,v.churchName,now,invite!.id,now),
   db().prepare('UPDATE leader_invites SET claimed_by=? WHERE id=? AND EXISTS (SELECT 1 FROM church_applications WHERE id=?)').bind(user.userId,invite!.id,id)
  ]);
  if(!results[1].meta.changes)fail(409,'이미 사용된 코드이거나 신청이 접수되었습니다. 신청 상태를 확인해 주세요.');
  return json({id,status:'pending'});
 }
 if(!owner)fail(403,'총관리자만 이용할 수 있습니다.');
 if(path[1]==='invites'){
  if(method==='GET')return json((await db().prepare('SELECT i.id,i.label,i.active,i.expires,i.claimed_by,i.created,p.name AS claimedName FROM leader_invites i LEFT JOIN profiles p ON p.id=i.claimed_by ORDER BY i.created DESC').all()).results);
  if(method==='POST'&&path.length===2){const v=z.object({label:z.string().trim().min(1).max(100)}).parse(await read());const id=crypto.randomUUID(),code=crypto.randomUUID().replaceAll('-',''),now=Date.now(),expires=now+7*86400000;await db().prepare('INSERT INTO leader_invites (id,code_hash,label,active,expires,created_by,created) VALUES (?,?,?,1,?,?,?)').bind(id,await digest(code),v.label,expires,user.userId,now).run();return json({id,code,expires});}
  if(method==='PATCH'&&path.length===3){const r=await db().prepare('UPDATE leader_invites SET active=0 WHERE id=? AND claimed_by IS NULL').bind(path[2]).run();if(!r.meta.changes)fail(409,'이미 사용되었거나 없는 코드입니다.');return json({ok:true});}
 }
 if(path[1]==='applications'){
  if(method==='GET'&&path.length===2)return json((await db().prepare('SELECT a.*,i.label AS inviteLabel FROM church_applications a JOIN leader_invites i ON i.id=a.invite_id ORDER BY CASE a.status WHEN \'pending\' THEN 0 ELSE 1 END,a.created DESC').all()).results);
  if(method==='POST'&&path.length===4&&['approve','reject'].includes(path[3])){
   const a=await db().prepare('SELECT a.*,p.active AS account_active FROM church_applications a JOIN profiles p ON p.id=a.user_id WHERE a.id=?').bind(path[2]).first<any>();if(!a)fail(404,'신청을 찾을 수 없습니다.');if(a.status!=='pending')fail(409,'이미 처리한 신청입니다.');
   if(path[3]==='reject'){const v=z.object({reason:z.string().trim().min(1).max(1000)}).parse(await read());const r=await db().prepare("UPDATE church_applications SET status='rejected',reason=?,reviewed=?,reviewed_by=? WHERE id=? AND status='pending'").bind(v.reason,Date.now(),user.userId,a.id).run();if(!r.meta.changes)fail(409,'이미 처리한 신청입니다.');return json({ok:true});}
   if(!a.account_active)fail(403,'접근이 중지된 계정입니다.');
   const id=crypto.randomUUID(),now=Date.now();
   const results=await db().batch([
    db().prepare("INSERT INTO churches (id,name,created_by,active,created) SELECT ?,church_name,user_id,1,? FROM church_applications WHERE id=? AND status='pending'").bind(id,now,a.id),
    db().prepare("INSERT INTO memberships (church_id,user_id,role,position,active,leader_requested,created) SELECT ?,user_id,'admin','인도자',1,0,? FROM church_applications WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM churches WHERE id=?)").bind(id,now,a.id,id),
    db().prepare("UPDATE church_applications SET status='approved',church_id=?,reviewed=?,reviewed_by=? WHERE id=? AND status='pending'").bind(id,now,user.userId,a.id)
   ]);if(!results[2].meta.changes)fail(409,'이미 처리한 신청입니다.');return json({ok:true,churchId:id});
  }
 }
 return fail(404,'요청을 찾을 수 없습니다.');
}
