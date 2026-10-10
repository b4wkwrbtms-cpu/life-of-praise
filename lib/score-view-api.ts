import {db,fail,getService,json} from './server';
import type {Profile} from './types';
import type {ScoreView,ScoreViewMember,SongNotes} from './score-views';

export async function scoreViewApi(req:Request,id:string,p:Profile){
 if(req.method!=='GET')fail(405,'팀원 악보는 읽기만 가능합니다. 내 연주 표시는 본인 악보에서 수정해 주세요.');
 const url=new URL(req.url),version=Number(url.searchParams.get('version'));
 if(!Number.isSafeInteger(version)||version<1)fail(400,'공개 악보 버전을 확인해 주세요.');
 const {row,data}=await getService(id,p,version);
 if(!row.published||version>row.version)fail(404,'공개 악보를 찾을 수 없습니다.');
 const team=await db().prepare(`SELECT p.id,p.name,m.position FROM memberships m JOIN profiles p ON p.id=m.user_id
  WHERE m.church_id=? AND m.active=1 AND p.active=1 ORDER BY m.position,p.name,p.id`).bind(p.churchId).all<ScoreViewMember>();
 const members=team.results;
 if(!members.some(m=>m.id===p.id))members.unshift({id:p.id,name:p.name,position:p.position});
 const requested=url.searchParams.get('user')||p.id,userId=requested==='common'?null:requested;
 const target=userId?members.find(m=>m.id===userId):null;
 if(userId&&!target)fail(404,'현재 교회에서 활동 중인 팀원의 악보만 볼 수 있습니다.');
 const songs:Record<string,SongNotes>={};
 if(userId){
  const rows=await db().prepare(`SELECT n.song_id,n.data,n.version,n.revision,n.updated FROM personal n
   WHERE n.user_id=? AND n.service_id=? AND n.version<=? AND NOT EXISTS (
    SELECT 1 FROM personal newer WHERE newer.user_id=n.user_id AND newer.service_id=n.service_id
    AND newer.song_id=n.song_id AND newer.version<=? AND newer.version>n.version)`)
   .bind(userId,id,version,version).all<{song_id:string;data:string;version:number;revision:number;updated:number}>();
  const ids=new Set(data.songs.map(s=>s.id));
  for(const r of rows.results)if(ids.has(r.song_id))songs[r.song_id]={notes:JSON.parse(r.data).notes||[],basedVersion:r.version,revision:r.revision,updated:r.updated};
 }
 const view:ScoreView={serviceId:id,version,userId,name:target?.name||'',position:target?.position||'',own:userId===p.id,members,songs};
 return json(view);
}
