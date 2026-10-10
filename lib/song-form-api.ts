import {z} from 'zod';
import {changes,db,fail,getService,json,layoutSchema,songSchema,worshipSchema} from './server';
import {applySongForm,sameSongForm} from './song-form';
import type {Profile,Service,Worship} from './types';

const patchSchema=z.object({
 form:songSchema.shape.form.min(1),layout:layoutSchema,
 markers:songSchema.shape.markers.unwrap(),
 pageLayouts:z.array(z.object({pageId:z.string().min(1).max(100),layout:layoutSchema.optional()}).strict()).max(30)
}).strict();
const saveSchema=z.object({revision:z.number().int().min(1),version:z.number().int().min(1),patch:patchSchema}).strict();
function snapshot(id:string,row:any,data:Worship):Service{return {id,title:data.title,date:data.date,data,version:row.version,revision:row.revision,published:true,finalized:!!row.finalized,updated:row.updated,changes:JSON.parse(row.changes),seen:0}}

export async function songFormApi(req:Request,id:string,songId:string,p:Profile,read:()=>Promise<unknown>){
 if(!['GET','PATCH'].includes(req.method))fail(405,'기존 곡의 송폼만 수정할 수 있습니다.');
 const {row,data}=await getService(id,p);
 if(!row.published)fail(404,'공개된 곡만 송폼을 수정할 수 있습니다.');
 const song=data.songs.find(s=>s.id===songId);
 if(!song)return fail(404,'해당 찬양을 찾을 수 없습니다.');
 if(req.method==='GET')return json(snapshot(id,row,data));
 const v=saveSchema.parse(await read());
 if(v.revision!==row.revision||v.version!==row.version)fail(409,'다른 사람이 먼저 수정했습니다. 입력은 유지했습니다. 최신 악보를 다시 열어 확인해 주세요.');
 if(v.patch.pageLayouts.length!==song.pages.length||new Set(v.patch.pageLayouts.map(p=>p.pageId)).size!==song.pages.length||v.patch.pageLayouts.some(p=>!song.pages.some(page=>page.id===p.pageId)))fail(400,'송폼 수정에서는 악보 페이지를 추가하거나 교체할 수 없습니다.');
 const nextSong=applySongForm(song,v.patch);
 const next=worshipSchema.parse({...data,songs:data.songs.map(s=>s.id===songId?nextSong:s)});
 if(sameSongForm(song,nextSong))return json(snapshot(id,row,data));
 const draft=JSON.parse(row.draft) as Worship,draftSong=draft.songs.find(s=>s.id===songId);
 // Preserve all unpublished leader content, and reject conflicts in this song's score.
 if(!draftSong||!sameSongForm(song,draftSong))fail(409,'인도자가 이 곡의 송폼 또는 악보를 편집 중입니다. 공개가 끝난 뒤 다시 수정해 주세요.');
 const nextDraft=worshipSchema.parse({...draft,songs:draft.songs.map(s=>s.id===songId?applySongForm(s,v.patch):s)});
 const version=row.version+1,updated=Date.now(),log=[`${p.name} · ${p.position}: ${song.title} 송폼 수정`,...changes(data,next)];
 const j=JSON.stringify(next),dj=JSON.stringify(nextDraft),lj=JSON.stringify(log);
 const results=await db().batch([
  db().prepare('INSERT INTO versions (service_id,version,data,created,changes) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM services WHERE id=? AND church_id=? AND revision=? AND version=? AND deleted=0)').bind(id,version,j,updated,lj,id,p.churchId,v.revision,v.version),
  db().prepare('UPDATE services SET published=?,draft=?,version=?,revision=revision+1,finalized=0,updated=?,changes=? WHERE id=? AND church_id=? AND revision=? AND version=? AND deleted=0').bind(j,dj,version,updated,lj,id,p.churchId,v.revision,v.version)
 ]);
 if(!results[1].meta.changes)fail(409,'새 수정 내용이 먼저 저장되었습니다. 입력을 유지한 채 최신 악보를 확인해 주세요.');
 return json(snapshot(id,{...row,version,revision:row.revision+1,finalized:0,updated,changes:lj},next));
}
