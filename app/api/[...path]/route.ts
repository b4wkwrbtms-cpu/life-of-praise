import {z} from 'zod';
import {accountApi,teamApi} from '@/lib/church-api';
import {purgeService} from '@/lib/purge-service';
import {ApiError,admin,bindings,changes,db,digest,fail,getService,identity,isOwner,json,member,profileSchema,worshipSchema,songSchema,validateSongFiles} from '@/lib/server';
import type {Profile,Worship} from '@/lib/types';
export const dynamic='force-dynamic';
const read=async(req:Request)=>{if(Number(req.headers.get('content-length')||0)>2000000)fail(413,'입력 내용이 너무 큽니다.');try{return await req.json()}catch{fail(400,'입력 내용을 확인해 주세요.')}};
async function handle(req:Request){try{
const url=new URL(req.url),path=url.pathname.replace(/^\/api\//,'').split('/'),method=req.method;
if(method!=='GET'&&(req.headers.get('sec-fetch-site')==='cross-site'||(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)))fail(403,'같은 앱에서 다시 시도해 주세요.');
const user=await identity();
const accountResponse=await accountApi(req,path,user,()=>read(req));if(accountResponse)return accountResponse;
const p=await member(req);
if(path[0]==='team')return await teamApi(req,p,()=>read(req));
if(path[0]==='invite'&&method==='POST'){admin(p);const code=crypto.randomUUID().replaceAll('-','');await db().prepare('UPDATE churches SET invite_hash=? WHERE id=?').bind(await digest(code),p.churchId).run();return json({code,churchId:p.churchId});}
if(path[0]==='files'){
 if(method==='POST'){
 const kind=url.searchParams.get('kind')||'raw';if(!['raw','export','comment','personal'].includes(kind))fail(400,'파일 종류를 확인해 주세요.');if(kind==='raw'||kind==='export')admin(p);
 const len=Number(req.headers.get('content-length')||0);if(len>22*1024*1024)fail(413,'파일은 20MB 이하로 올려 주세요.');const form=await req.formData();const f=form.get('file');if(!(f instanceof File)||f.size>20*1024*1024||!f.size)fail(400,'20MB 이하의 이미지 또는 PDF를 선택해 주세요.');
 const file=f as File;let mime=file.type;if(!['image/png','image/jpeg','application/pdf'].includes(mime))fail(400,'JPG·PNG·PDF를 지원합니다. HEIC는 JPG로 변환해 주세요.');if(['comment','personal','export'].includes(kind)&&mime==='application/pdf')fail(400,'이미지를 선택해 주세요.');
 const bytes=await file.arrayBuffer(),head=new Uint8Array(bytes.slice(0,8));if((mime==='image/png'&&head[0]!==137)||(mime==='image/jpeg'&&!(head[0]===255&&head[1]===216))||(mime==='application/pdf'&&new TextDecoder().decode(head).slice(0,4)!=='%PDF'))fail(400,'파일 형식을 확인할 수 없습니다.');
 const id=crypto.randomUUID();await bindings().BUCKET.put(id,bytes,{httpMetadata:{contentType:mime}});await db().prepare('INSERT INTO files (id,church_id,owner,name,type,kind,shared,size,created) VALUES (?,?,?,?,?,?,0,?,?)').bind(id,p.churchId,p.id,file.name.slice(0,200),mime,kind,file.size,Date.now()).run();return json({id});
 }
 if(method==='GET'&&path[1]){const f=await db().prepare('SELECT * FROM files WHERE id=? AND church_id=?').bind(path[1],p.churchId).first<any>();if(!f||!(f.owner===p.id||f.shared||(p.role==='admin'&&f.kind!=='personal')))fail(404,'파일을 찾을 수 없습니다.');const obj=await bindings().BUCKET.get(f.id);if(!obj)fail(404,'파일이 없습니다.');return new Response(obj!.body,{headers:{'Content-Type':f.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(f.name)}`}});}
}
if(path[0]==='fixed-songs'){
 admin(p);
 if(path.length===1&&method==='GET'){const r=await db().prepare('SELECT * FROM fixed_songs WHERE church_id=? ORDER BY updated ASC,id ASC').bind(p.churchId).all<any>();return json(r.results.map(f=>({id:f.id,title:f.title,data:JSON.parse(f.data),revision:f.revision,autoAdd:!!f.auto_add,updated:f.updated})));}
 if((path.length===1&&method==='POST')||(path[1]&&method==='PUT')){
 const v=z.object({song:songSchema,revision:z.number().int().optional(),autoAdd:z.boolean().default(false)}).parse(await read(req));const song=v.song;await validateSongFiles([song],p);
 if(!song.title.trim()||!song.pages.length||!song.form.length)fail(400,'고정찬양은 제목·악보·송폼을 먼저 입력해 주세요.');
 if((song.markers||[]).some(m=>!song.pages.some(p=>p.id===m.pageId)))fail(400,'구간 표시의 페이지를 확인해 주세요.');
 const id=method==='POST'?crypto.randomUUID():path[1];const data=JSON.stringify({...song,fixedId:id,exports:[]});let revision=1;
 if(method==='POST')await db().prepare('INSERT INTO fixed_songs (id,church_id,title,data,revision,auto_add,updated) VALUES (?,?,?,?,1,?,?)').bind(id,p.churchId,song.title,data,Number(v.autoAdd),Date.now()).run();
 else{if(!v.revision)fail(400,'고정찬양 버전을 확인해 주세요.');const r=await db().prepare('UPDATE fixed_songs SET title=?,data=?,revision=revision+1,auto_add=?,updated=? WHERE id=? AND revision=? AND church_id=?').bind(song.title,data,Number(v.autoAdd),Date.now(),id,v.revision,p.churchId).run();if(!r.meta.changes)fail(409,'고정찬양이 변경되었습니다. 다시 불러와 주세요.');revision=v.revision!+1;}
 return json({id,revision});
 }
 if(path[1]&&method==='PATCH'){const v=z.object({revision:z.number().int(),autoAdd:z.boolean()}).parse(await read(req));const r=await db().prepare('UPDATE fixed_songs SET auto_add=?,revision=revision+1 WHERE id=? AND revision=? AND church_id=?').bind(Number(v.autoAdd),path[1],v.revision,p.churchId).run();if(!r.meta.changes)fail(409,'고정찬양이 변경되었습니다. 새로고침해 주세요.');return json({ok:true});}
 if(path[1]&&method==='DELETE'){const v=z.object({revision:z.number().int()}).parse(await read(req));const r=await db().prepare('DELETE FROM fixed_songs WHERE id=? AND revision=? AND church_id=?').bind(path[1],v.revision,p.churchId).run();if(!r.meta.changes)fail(409,'고정찬양이 변경되었습니다. 새로고침해 주세요.');return json({ok:true});}
}
if(path[0]==='services'){
 if(path.length===1&&method==='GET'){
 const trash=url.searchParams.get('trash')==='1';if(trash)admin(p);
 const rows=await db().prepare(`SELECT s.*,COALESCE(c.version,0) AS seen FROM services s LEFT JOIN confirmations c ON c.service_id=s.id AND c.user_id=? WHERE s.deleted=? AND s.church_id=? ${p.role==='admin'?'':'AND s.published IS NOT NULL'} ORDER BY s.date DESC,s.updated DESC`).bind(p.id,Number(trash),p.churchId).all<any>();
 return json(rows.results.map(r=>({id:r.id,title:r.title,date:r.date,data:JSON.parse(r.published||r.draft),...(p.role==='admin'?{draft:JSON.parse(r.draft),hasDraft:!!r.published&&r.draft!==r.published}:{}),deleted:!!r.deleted,version:r.version,revision:r.revision,published:!!r.published,finalized:!!r.finalized,updated:r.updated,changes:JSON.parse(r.changes),seen:r.seen})));}
 if(path.length===1&&method==='POST'){admin(p);const d=worshipSchema.parse(await read(req));await validateSongFiles(d.songs,p);const id=crypto.randomUUID();await db().prepare('INSERT INTO services (id,church_id,title,date,draft,version,revision,finalized,updated,changes) VALUES (?,?,?,?,?,0,1,0,?,?)').bind(id,p.churchId,d.title,d.date,JSON.stringify(d),Date.now(),'[]').run();return json({id,revision:1});}
 const id=path[1];if(!id)fail(404,'경로가 없습니다.');
 if(path.length===3&&path[2]==='purge'&&method==='DELETE'){admin(p);const v=z.object({revision:z.number().int().min(1)}).parse(await read(req));return json(await purgeService(id,v.revision,p.churchId!));}
 if(path[2]==='restore'&&method==='POST'){admin(p);const v=z.object({revision:z.number().int()}).parse(await read(req));const r=await db().prepare('UPDATE services SET deleted=0,revision=revision+1,updated=? WHERE id=? AND deleted=1 AND revision=? AND church_id=?').bind(Date.now(),id,v.revision,p.churchId).run();if(!r.meta.changes)fail(409,'목록이 변경되었습니다. 휴지통을 새로고침해 주세요.');return json({ok:true});}
 const {row,data}=await getService(id,p);
 if(path.length===2&&method==='DELETE'){admin(p);const v=z.object({revision:z.number().int()}).parse(await read(req));const r=await db().prepare('UPDATE services SET deleted=1,revision=revision+1,updated=? WHERE id=? AND deleted=0 AND revision=?').bind(Date.now(),id,v.revision).run();if(!r.meta.changes)fail(409,'자료가 변경되었습니다. 새로고침 후 삭제해 주세요.');return json({ok:true});}
 if(path[2]==='discard-draft'&&method==='POST'){admin(p);if(!row.published)fail(400,'미공개 초안은 삭제 버튼을 이용해 주세요.');const v=z.object({revision:z.number().int()}).parse(await read(req));const r=await db().prepare('UPDATE services SET draft=published,revision=revision+1,updated=? WHERE id=? AND revision=? AND deleted=0').bind(Date.now(),id,v.revision).run();if(!r.meta.changes)fail(409,'자료가 변경되었습니다. 새로고침해 주세요.');return json({ok:true});}
 if(path[2]==='versions'&&method==='GET'){const r=await db().prepare('SELECT version,data,created,changes FROM versions WHERE service_id=? ORDER BY version DESC').bind(id).all<any>();return json(r.results.map(v=>({...v,data:JSON.parse(v.data),changes:JSON.parse(v.changes)})));}
 if(path[2]==='confirm'&&method==='POST'){const v=z.object({version:z.number().int()}).parse(await read(req));if(v.version!==row.version)fail(409,'새로운 변경이 있습니다. 다시 확인해 주세요.');await db().prepare('INSERT INTO confirmations (user_id,service_id,version) VALUES (?,?,?) ON CONFLICT(user_id,service_id) DO UPDATE SET version=excluded.version').bind(p.id,id,v.version).run();return json({ok:true});}
 if(path[2]==='finalize'&&method==='POST'){admin(p);if(!row.published)fail(400,'먼저 자료를 공개해 주세요.');await db().prepare('UPDATE services SET finalized=1,updated=? WHERE id=?').bind(Date.now(),id).run();return json({ok:true});}
 if(path[2]==='publish'&&method==='POST'){
 admin(p);const v=z.object({revision:z.number().int(),data:worshipSchema}).parse(await read(req));const d=v.data;await validateSongFiles(d.songs,p);if(v.revision!==row.revision)fail(409,'다른 창에서 수정되었습니다. 저장한 내용을 확인하고 다시 열어 주세요.');if(!d.passage.trim()||!d.scripture.trim()||!d.songs.length||d.songs.some(s=>!s.title.trim()||!s.pages.length||!s.form.length||s.exports.length!==s.pages.length))fail(400,'본문과 각 곡의 제목·악보·송폼을 모두 준비해 주세요.');
 const ids=[...new Set(d.songs.flatMap(s=>[...s.pages.flatMap(p=>[p.id,...(p.source?[p.source]:[])]),...s.exports]))];
 const next=row.version+1,log=changes(row.published?data:undefined,d),j=JSON.stringify(d),now=Date.now();
 const ops=[db().prepare('INSERT INTO versions (service_id,version,data,created,changes) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM services WHERE id=? AND revision=? AND deleted=0)').bind(id,next,j,now,JSON.stringify(log),id,v.revision),db().prepare('UPDATE services SET title=?,date=?,draft=?,published=?,version=?,revision=revision+1,finalized=0,updated=?,changes=? WHERE id=? AND revision=? AND deleted=0').bind(d.title,d.date,j,j,next,now,JSON.stringify(log),id,v.revision),...ids.map(fid=>db().prepare('UPDATE files SET shared=1 WHERE id=?').bind(fid))];
 const out=await db().batch(ops);if(!out[1].meta.changes)fail(409,'새 버전이 먼저 저장되었습니다. 다시 열어 주세요.');return json({ok:true,version:next,revision:v.revision+1});
 }
 if(path.length===2&&method==='PUT'){admin(p);const v=z.object({revision:z.number().int(),data:worshipSchema}).parse(await read(req));const d=v.data;await validateSongFiles(d.songs,p);const r=await db().prepare('UPDATE services SET draft=?,title=CASE WHEN published IS NULL THEN ? ELSE title END,date=CASE WHEN published IS NULL THEN ? ELSE date END,revision=revision+1,updated=? WHERE id=? AND revision=? AND deleted=0').bind(JSON.stringify(d),d.title,d.date,Date.now(),id,v.revision).run();if(!r.meta.changes)fail(409,'다른 창의 변경이 있습니다. 편집 내용을 복사한 뒤 다시 열어 주세요.');return json({revision:v.revision+1});}
 if(path[2]==='personal'){
 const songId=path[3];const version=Number(url.searchParams.get('version')||row.version);const source=await getService(id,p,version);if(!source.data.songs.some(s=>s.id===songId))fail(404,'해당 곡이 없습니다.');
 if(method==='GET'){const r=await db().prepare('SELECT data,revision,version FROM personal WHERE user_id=? AND service_id=? AND song_id=? AND version<=? ORDER BY version DESC LIMIT 1').bind(p.id,id,songId,version).first<any>();return json(r?{...JSON.parse(r.data),revision:r.version===version?r.revision:0,basedVersion:r.version,reviewed:r.version===version}: {notes:[],basedVersion:version,reviewed:true,revision:0,exports:[]});}
 if(method==='PUT'){const v=z.object({revision:z.number().int().min(0),notes:z.array(z.object({id:z.string().max(100),pageId:z.string().max(100),x:z.number().min(0).max(1),y:z.number().min(0).max(1),text:z.string().min(1).max(160),size:z.number().min(.008).max(.08),color:z.enum(['#315d48','#a84f2b','#315e9b','#242c28']),sectionId:z.string().optional()})).max(200),exports:z.array(z.string()).max(30)}).parse(await read(req));
 for(const f of v.exports){const valid=await db().prepare("SELECT id FROM files WHERE id=? AND owner=? AND church_id=? AND kind='personal'").bind(f,p.id,p.churchId).first();if(!valid)fail(400,'개인 저장 파일을 확인해 주세요.');}
 const val=JSON.stringify({notes:v.notes,exports:v.exports});let res;if(v.revision===0){res=await db().prepare('INSERT OR IGNORE INTO personal (user_id,service_id,song_id,version,data,revision,updated) VALUES (?,?,?,?,?,1,?)').bind(p.id,id,songId,version,val,Date.now()).run();}else{res=await db().prepare('UPDATE personal SET data=?,revision=revision+1,updated=? WHERE user_id=? AND service_id=? AND song_id=? AND version=? AND revision=?').bind(val,Date.now(),p.id,id,songId,version,v.revision).run();}if(!res.meta.changes)fail(409,'다른 창에서 개인 악보가 변경되었습니다. 다시 열어 주세요.');return json({revision:v.revision+1});}
 }
}
if(path[0]==='comments'){
 if(method==='GET'){const sid=url.searchParams.get('service');if(!sid)fail(400,'예배를 선택해 주세요.');await getService(sid!,p);const r=await db().prepare('SELECT c.*,p.name,m.position FROM comments c JOIN profiles p ON p.id=c.user_id LEFT JOIN memberships m ON m.user_id=c.user_id AND m.church_id=? WHERE c.service_id=? ORDER BY c.created').bind(p.churchId,sid).all();return json(r.results);}
 if(method==='POST'){const v=z.object({serviceId:z.string(),songId:z.string().default(''),text:z.string().trim().min(1).max(5000),parentId:z.string().default(''),attachment:z.string().default('')}).parse(await read(req));const {row,data}=await getService(v.serviceId,p);if(!row.published)fail(400,'공개 후 질문을 남겨 주세요.');if(v.songId&&!data.songs.some(s=>s.id===v.songId))fail(400,'곡을 확인해 주세요.');if(v.parentId){const parent=await db().prepare('SELECT id FROM comments WHERE id=? AND service_id=? AND song_id=?').bind(v.parentId,v.serviceId,v.songId).first();if(!parent)fail(400,'답글 대상을 확인해 주세요.');}if(v.attachment){const f=await db().prepare("SELECT id FROM files WHERE id=? AND owner=? AND church_id=? AND kind='comment'").bind(v.attachment,p.id,p.churchId).first();if(!f)fail(400,'첨부 이미지를 확인해 주세요.');}
 const id=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO comments (id,service_id,song_id,user_id,text,parent_id,attachment,resolved,pinned,version,created) VALUES (?,?,?,?,?,?,?,0,0,?,?)').bind(id,v.serviceId,v.songId,p.id,v.text,v.parentId,v.attachment,row.version,Date.now()),db().prepare('UPDATE files SET shared=1 WHERE id=? AND owner=?').bind(v.attachment,p.id)]);return json({id});}
 const c=await db().prepare('SELECT * FROM comments WHERE id=?').bind(path[1]||'').first<any>();if(!c)fail(404,'댓글을 찾을 수 없습니다.');await getService(c.service_id,p);
 if(method==='DELETE'){if(c.user_id!==p.id&&p.role!=='admin')fail(403,'본인의 댓글만 삭제할 수 있습니다.');await db().prepare("UPDATE comments SET text='삭제된 댓글입니다.',attachment='' WHERE id=?").bind(c.id).run();return json({ok:true});}
 if(method==='PATCH'){const v=z.object({resolved:z.boolean().optional(),pinned:z.boolean().optional(),text:z.string().trim().min(1).max(5000).optional()}).parse(await read(req));if(v.pinned!==undefined)admin(p);if((v.resolved!==undefined||v.text!==undefined)&&c.user_id!==p.id&&p.role!=='admin')fail(403,'변경 권한이 없습니다.');await db().prepare('UPDATE comments SET resolved=?,pinned=?,text=? WHERE id=?').bind(v.resolved===undefined?c.resolved:Number(v.resolved),v.pinned===undefined?c.pinned:Number(v.pinned),v.text??c.text,c.id).run();return json({ok:true});}
}
fail(404,'요청을 찾을 수 없습니다.');
}catch(e){if(e instanceof ApiError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'입력 내용을 확인해 주세요.'},400);console.error('API failure',e);return json({error:'저장소에 연결하지 못했습니다. 입력한 내용을 유지한 채 다시 시도해 주세요.'},500);}}
export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
