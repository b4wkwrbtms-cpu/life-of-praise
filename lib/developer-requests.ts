import {z} from 'zod';
import {db,fail,json} from './server';
import {REQUEST_CATEGORIES,type Profile} from './types';

const select='SELECT r.*,c.name AS church_name,p.name AS author,(SELECT count(*) FROM developer_replies m WHERE m.request_id=r.id) AS replyCount FROM developer_requests r JOIN churches c ON c.id=r.church_id JOIN profiles p ON p.id=r.user_id';
export async function developerApi(req:Request,path:string[],p:Profile,read:()=>Promise<any>){
 const method=req.method,url=new URL(req.url),all=url.searchParams.get('scope')==='all';
 if(all&&!p.superAdmin)fail(403,'전체 요청은 총관리자만 확인할 수 있습니다.');
 if(path.length===1&&method==='GET'){
  const church=all?url.searchParams.get('church'):p.churchId;
  const result=await db().prepare(select+' WHERE c.deleted_at IS NULL'+(church?' AND r.church_id=?':'')+' ORDER BY r.updated DESC').bind(...(church?[church]:[])).all();return json(result.results);
 }
 if(path.length===1&&method==='POST'){
  const v=z.object({id:z.string().uuid(),title:z.string().trim().min(2).max(160),category:z.enum(REQUEST_CATEGORIES),details:z.string().trim().min(5).max(6000)}).parse(await read());const now=Date.now();
  const r=await db().prepare("INSERT OR IGNORE INTO developer_requests (id,church_id,user_id,title,category,details,status,revision,created,updated) VALUES (?,?,?,?,?,?,'received',1,?,?)").bind(v.id,p.churchId,p.id,v.title,v.category,v.details,now,now).run();
  if(!r.meta.changes){const existing=await db().prepare('SELECT id FROM developer_requests WHERE id=? AND church_id=? AND user_id=?').bind(v.id,p.churchId,p.id).first();if(!existing)fail(409,'요청 번호가 중복되었습니다. 다시 시도해 주세요.');}return json({id:v.id});
 }
 const request=await db().prepare(select+' WHERE r.id=? AND c.deleted_at IS NULL'+(p.superAdmin?'':' AND r.church_id=?')).bind(path[1]||'',...(p.superAdmin?[]:[p.churchId])).first<any>();if(!request)fail(404,'요청을 찾을 수 없습니다.');
 if(path.length===2&&method==='GET'){const replies=await db().prepare('SELECT m.id,m.text,m.developer,m.created,p.name AS author FROM developer_replies m JOIN profiles p ON p.id=m.user_id WHERE m.request_id=? ORDER BY m.created,m.id').bind(request.id).all();return json({request,replies:replies.results});}
 if(path.length===2&&method==='PATCH'){
  if(!p.superAdmin)fail(403,'개발 진행 상태는 총관리자만 변경할 수 있습니다.');
  const v=z.object({status:z.enum(['received','reviewing','working','done','held']),revision:z.number().int().min(1)}).parse(await read());const r=await db().prepare('UPDATE developer_requests SET status=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(v.status,Date.now(),request.id,v.revision).run();if(!r.meta.changes)fail(409,'요청 상태가 변경되었습니다. 다시 확인해 주세요.');return json({ok:true});
 }
 if(path.length===3&&path[2]==='replies'&&method==='POST'){
  const v=z.object({id:z.string().uuid(),text:z.string().trim().min(1).max(6000)}).parse(await read());const now=Date.now();
  const existing=await db().prepare('SELECT request_id,user_id FROM developer_replies WHERE id=?').bind(v.id).first<any>();if(existing){if(existing.request_id!==request.id||existing.user_id!==p.id)fail(409,'답변 번호가 중복되었습니다.');return json({id:v.id});}
  await db().batch([db().prepare('INSERT OR IGNORE INTO developer_replies (id,request_id,user_id,text,developer,created) VALUES (?,?,?,?,?,?)').bind(v.id,request.id,p.id,v.text,Number(!!p.superAdmin),now),db().prepare('UPDATE developer_requests SET updated=? WHERE id=?').bind(now,request.id)]);return json({id:v.id});
 }
 fail(405,'지원하지 않는 요청입니다.');
}
