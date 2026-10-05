import {z} from 'zod';
import {myApplications} from './platform-api';
import {db,fail,isOwner,json,profileSchema,digest} from './server';
import {churchContext,churchList,churchResponse,churchName,ensureChurches,findInvite,LEGACY_CHURCH} from './churches';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import type {Profile} from './types';

export async function accountApi(req:Request,path:string[],user:ChatGPTUser,read:()=>Promise<any>):Promise<Response|null>{
 if(!['me','churches'].includes(path[0]))return null;
 await ensureChurches();const owner=isOwner(user.email),account=await db().prepare('SELECT * FROM profiles WHERE id=?').bind(user.userId).first<Profile>();
 if(path[0]==='me'&&req.method==='GET'){const context=await churchContext(req,user,true);return json({...context,applications:await myApplications(user.userId),owner,superAdmin:owner,name:user.fullName||'',email:user.email,blocked:!!account&&!account.active});}
 if(account&&!account.active)fail(403,'계정 접근이 중지되었습니다. 총관리자에게 문의해 주세요.');
 if(path[0]==='me'&&req.method==='POST'){
  const v=profileSchema.parse(await read());let churchId='';
  if(v.invite)churchId=(await findInvite(v.invite)).id;
  else if(!account&&owner)churchId=LEGACY_CHURCH;
  else if(!account)fail(403,'교회 팀원 초대 코드 또는 총관리자의 인도자 초대 코드가 필요합니다.');
  else churchId=(await churchContext(req,user,true)).church?.id||'';
  if(!churchId)fail(403,'참여할 교회를 선택해 주세요.');
  const existing=await db().prepare('SELECT active,role FROM memberships WHERE church_id=? AND user_id=?').bind(churchId,user.userId).first<any>();if(existing&&!existing.active&&!owner)fail(403,'이 교회에서 접근이 중지되었습니다. 인도자에게 문의해 주세요.');
  if(v.position==='인도자'&&!owner&&existing?.role!=='admin')fail(403,'인도자는 총관리자의 초대 코드로 가입 신청 후 승인을 받아야 합니다.');
  await db().batch([
   db().prepare("INSERT INTO profiles (id,name,position,role,active,created,legacy_church) VALUES (?,?,?,'member',1,?,NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name,position=excluded.position").bind(user.userId,v.name,v.position,Date.now()),
   db().prepare("INSERT INTO memberships (church_id,user_id,role,position,active,leader_requested,created) VALUES (?,?,?,?,1,?,?) ON CONFLICT(church_id,user_id) DO UPDATE SET position=excluded.position,leader_requested=CASE WHEN memberships.role='admin' THEN 0 ELSE excluded.leader_requested END").bind(churchId,user.userId,owner?'admin':'member',v.position,0,Date.now())
  ]);return churchResponse(churchId);
 }
 if(path[0]!=='churches')return null;
 if(path.length===1&&req.method==='GET')return json(await churchList(user,new URL(req.url).searchParams.get('trash')==='1'));
 if(path.length===1&&req.method==='POST')fail(403,'인도자 초대 코드로 개설을 신청하고 총관리자의 승인을 받아 주세요.');
 if(path[1]==='select'&&req.method==='POST'){
  const v=z.object({id:z.string().min(1).max(100)}).parse(await read());const list=await churchList(user);if(!list.some(c=>c.id===v.id&&(c.active||owner)))fail(403,'이 교회에 접근할 권한이 없습니다.');return churchResponse(v.id);
 }
 if((path.length===2&&req.method==='DELETE')||(path.length===3&&path[2]==='restore'&&req.method==='POST')){
  if(!owner)fail(403,'교회 삭제와 복원은 총관리자만 할 수 있습니다.');
  const id=path[1],restoring=path.length===3;
  const v=z.object({name:churchName,deletedAt:z.number().int().positive().optional()}).parse(await read());
  if(restoring&&!v.deletedAt)fail(400,'삭제한 교회 목록을 새로고침해 주세요.');
  const result=restoring
   ?await db().prepare('UPDATE churches SET deleted_at=NULL,deleted_by=NULL,invite_hash=NULL WHERE id=? AND name=? AND deleted_at=?').bind(id,v.name,v.deletedAt!).run()
   :await db().prepare('UPDATE churches SET deleted_at=?,deleted_by=?,invite_hash=NULL WHERE id=? AND name=? AND deleted_at IS NULL').bind(Date.now(),user.userId,id,v.name).run();
  if(!result.meta.changes)fail(409,'교회 이름이나 상태가 변경되었습니다. 목록을 새로고침해 주세요.');
  return json({ok:true});
 }
 if(path.length===2&&req.method==='PATCH'){
  const context=await churchContext(req,user,true),id=path[1];if(!owner&&(context.church?.id!==id||context.profile?.role!=='admin'))fail(403,'교회 설정 변경 권한이 없습니다.');
  const v=z.object({name:churchName.optional(),active:z.boolean().optional()}).parse(await read());if(v.active!==undefined&&!owner)fail(403,'전체 교회 운영 상태는 총관리자만 변경할 수 있습니다.');
  if(id===LEGACY_CHURCH&&v.active===false)fail(400,'기본 교회는 운영을 중지할 수 없습니다.');
  const r=await db().prepare('UPDATE churches SET name=COALESCE(?,name),active=COALESCE(?,active) WHERE id=? AND deleted_at IS NULL').bind(v.name??null,v.active===undefined?null:Number(v.active),id).run();if(!r.meta.changes)fail(404,'교회를 찾을 수 없습니다.');return json({ok:true});
 }
 return null;
}

export async function teamApi(req:Request,p:Profile,read:()=>Promise<any>){
 if(p.role!=='admin')fail(403,'이 교회의 인도자만 팀을 관리할 수 있습니다.');
 if(req.method==='GET'){const r=await db().prepare('SELECT p.id,p.name,m.position,m.role,m.active,m.leader_requested AS leaderRequested FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.church_id=? ORDER BY m.leader_requested DESC,m.created').bind(p.churchId).all();return json(r.results);}
 if(req.method==='PATCH'){
  const v=z.object({id:z.string(),active:z.boolean().optional(),role:z.enum(['admin','member']).optional(),rejectLeader:z.boolean().optional()}).parse(await read());
  const target=await db().prepare('SELECT * FROM memberships WHERE church_id=? AND user_id=?').bind(p.churchId,v.id).first<any>();if(!target)fail(404,'이 교회의 팀원을 찾을 수 없습니다.');
  if(v.role==='admin')fail(403,'인도자 권한은 총관리자의 교회 개설 승인으로만 부여됩니다.');
  if(!p.superAdmin&&(target.role==='admin'||v.role!==undefined||v.rejectLeader))fail(403,'인도자 권한 관리는 총관리자에게 요청해 주세요.');
  if(v.id===p.id&&(v.active===false||v.role==='member'))fail(400,'자신의 인도자 권한은 여기서 해제할 수 없습니다.');
  const r=await db().prepare("UPDATE memberships SET active=COALESCE(?,active),role=COALESCE(?,role),leader_requested=CASE WHEN ? THEN 0 ELSE leader_requested END WHERE church_id=? AND user_id=? AND (role!='admin' OR (?!=0 AND COALESCE(?,'admin')='admin') OR EXISTS (SELECT 1 FROM memberships other WHERE other.church_id=? AND other.user_id!=? AND other.role='admin' AND other.active=1))").bind(v.active===undefined?null:Number(v.active),v.role??null,Number(!!(v.role||v.rejectLeader)),p.churchId,v.id,v.active===false?0:1,v.role??null,p.churchId,v.id).run();if(!r.meta.changes)fail(400,'마지막 인도자는 해제할 수 없습니다. 다른 인도자를 먼저 승인해 주세요.');return json({ok:true});
 }
 fail(405,'지원하지 않는 요청입니다.');
}
