import {z} from 'zod';
import {db,fail,json} from './server';
import type {Profile} from './types';
export const GUIDE_VERSION=1;
export async function appSetupApi(req:Request,p:Profile,read:()=>Promise<unknown>){
 const role=p.role==='admin'?'leader':'team';
 if(req.method==='GET'){
  const guide=await db().prepare('SELECT version,completed_at AS completedAt FROM app_guides WHERE user_id=? AND role=?').bind(p.id,role).first<any>();
  const devices=await db().prepare('SELECT platform,installed_at AS installedAt,launched_at AS launchedAt FROM app_installations WHERE user_id=?').bind(p.id).all();
  return json({role,version:GUIDE_VERSION,completed:!!guide&&guide.version>=GUIDE_VERSION,devices:devices.results});
 }
 if(req.method==='POST'){
  const v=z.discriminatedUnion('action',[
   z.object({action:z.literal('complete-guide')}),
   z.object({action:z.literal('installation'),platform:z.enum(['ios','android','desktop']),event:z.enum(['installed','launched'])})
  ]).parse(await read());
  if(v.action==='complete-guide')await db().prepare('INSERT INTO app_guides (user_id,role,version,completed_at) VALUES (?,?,?,?) ON CONFLICT(user_id,role) DO UPDATE SET version=excluded.version,completed_at=excluded.completed_at').bind(p.id,role,GUIDE_VERSION,Date.now()).run();
  else {
   const now=Date.now();
   await db().prepare('INSERT INTO app_installations (user_id,platform,installed_at,launched_at) VALUES (?,?,?,?) ON CONFLICT(user_id,platform) DO UPDATE SET installed_at=COALESCE(app_installations.installed_at,excluded.installed_at),launched_at=COALESCE(excluded.launched_at,app_installations.launched_at)').bind(p.id,v.platform,now,v.event==='launched'?now:null).run();
  }
  return json({ok:true});
 }
 fail(405,'지원하지 않는 요청입니다.');
}
