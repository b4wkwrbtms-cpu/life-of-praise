import {db,bindings,fail} from './server';
import type {Worship} from './types';

// The copied score can belong to many weeks or fixed songs. Remove only files
// whose last saved reference disappeared, including references in the trash.
const unusedFile=`DELETE FROM files WHERE id=? AND church_id=?
 AND NOT EXISTS (SELECT 1 FROM services s,json_tree(s.draft) j WHERE j.type='text' AND j.atom=files.id)
 AND NOT EXISTS (SELECT 1 FROM services s,json_tree(s.published) j WHERE j.type='text' AND j.atom=files.id)
 AND NOT EXISTS (SELECT 1 FROM versions v,json_tree(v.data) j WHERE j.type='text' AND j.atom=files.id)
 AND NOT EXISTS (SELECT 1 FROM fixed_songs f,json_tree(f.data) j WHERE j.type='text' AND j.atom=files.id)
 AND NOT EXISTS (SELECT 1 FROM personal p,json_tree(p.data) j WHERE j.type='text' AND j.atom=files.id)
 AND NOT EXISTS (SELECT 1 FROM comments c WHERE c.attachment=files.id)`;

export async function purgeService(id:string,revision:number,churchId:string){
 const database=db();
 const row=await database.prepare('SELECT draft,published,deleted,revision FROM services WHERE id=? AND church_id=?').bind(id,churchId).first<{draft:string;published:string|null;deleted:number;revision:number}>();
 if(!row)fail(404,'이미 삭제되었거나 찾을 수 없는 예배입니다.');
 if(!row!.deleted)fail(400,'휴지통에 있는 예배만 영구 삭제할 수 있습니다.');
 if(row!.revision!==revision)fail(409,'예배가 변경되었습니다. 휴지통을 새로고침해 주세요.');
 const ids=new Set<string>();
 const collect=(text:string|null)=>{if(!text)return;const d=JSON.parse(text) as Worship;for(const song of d.songs){for(const page of song.pages){ids.add(page.id);if(page.source)ids.add(page.source)}for(const fid of song.exports)ids.add(fid)}};
 collect(row!.draft);collect(row!.published);
 const [history,personal,comments]=await Promise.all([
  database.prepare('SELECT data FROM versions WHERE service_id=?').bind(id).all<{data:string}>(),
  database.prepare('SELECT data FROM personal WHERE service_id=?').bind(id).all<{data:string}>(),
  database.prepare('SELECT attachment FROM comments WHERE service_id=?').bind(id).all<{attachment:string}>()
 ]);
 history.results.forEach(v=>collect(v.data));
 personal.results.forEach(v=>(JSON.parse(v.data).exports||[]).forEach((fid:string)=>ids.add(fid)));
 comments.results.forEach(v=>{if(v.attachment)ids.add(v.attachment)});
 const condition='EXISTS (SELECT 1 FROM services WHERE id=? AND deleted=1 AND revision=?)';
 const statements=['versions','personal','comments','confirmations'].map(table=>database.prepare(`DELETE FROM ${table} WHERE service_id=? AND ${condition}`).bind(id,id,revision));
 statements.push(database.prepare('DELETE FROM services WHERE id=? AND deleted=1 AND revision=?').bind(id,revision));
 const results=await database.batch(statements);
 if(!results[results.length-1].meta.changes)fail(409,'예배가 변경되었습니다. 휴지통을 새로고침해 주세요.');
 // The worship deletion above is atomic. Storage cleanup can be best-effort:
 // remove metadata first so a blob cannot remain reachable after unlinking.
 const candidates=[...ids];
 for(let i=0;i<candidates.length;i+=30){
  const chunk=candidates.slice(i,i+30);
  try{
   const removed=await database.batch(chunk.map(fid=>database.prepare(unusedFile).bind(fid,churchId)));
   const keys=chunk.filter((_,n)=>removed[n].meta.changes>0);
   if(keys.length)await bindings().BUCKET.delete(keys);
  }catch(error){console.error('Unused score-file cleanup failed after worship deletion',error)}
 }
 return {ok:true};
}
