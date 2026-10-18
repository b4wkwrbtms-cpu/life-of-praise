import {z} from 'zod';
import {db,fail,getService,idSchema,json} from './server';
import {readerPages} from './reader-layout';
import {validReaderPairs,type ReaderPair} from './reader-pairs';
import type {Profile,Service} from './types';
const pageRef=z.object({songId:idSchema,pageId:idSchema}).strict();
const schema=z.object({revision:z.number().int().min(0),pairs:z.array(z.tuple([pageRef,pageRef])).max(450)}).strict();

export async function readerPairApi(req:Request,id:string,p:Profile,read:()=>Promise<unknown>){
 if(!['GET','PUT'].includes(req.method))fail(405,'두 장 보기 설정은 불러오거나 저장할 수 있습니다.');
 const url=new URL(req.url),version=Number(url.searchParams.get('version'));
 if(url.searchParams.has('user')&&url.searchParams.get('user')!==p.id)fail(403,'두 장 보기 설정은 본인만 이용할 수 있습니다.');
 if(!Number.isSafeInteger(version)||version<1)fail(400,'공개 악보 버전을 확인해 주세요.');
 const {row,data}=await getService(id,p,version);
 if(!row.published||version>row.version)fail(404,'공개 악보를 찾을 수 없습니다.');
 const pages=readerPages({data} as Service);
 if(req.method==='GET'){
  const saved=await db().prepare('SELECT data,revision,version FROM reader_pairs WHERE church_id=? AND user_id=? AND service_id=? AND version<=? ORDER BY version DESC LIMIT 1').bind(p.churchId,p.id,id,version).first<{data:string;revision:number;version:number}>();
  const clean=validReaderPairs(pages,saved?JSON.parse(saved.data) as ReaderPair[]:[]);
  return json({...clean,version,basedVersion:saved?.version||version,revision:saved?.version===version?saved.revision:0});
 }
 const input=schema.parse(await read()),clean=validReaderPairs(pages,input.pairs);
 if(clean.removed)fail(400,'현재 예배의 서로 다른 두 페이지를 선택해 주세요. 한 페이지는 한 묶음에만 넣을 수 있습니다.');
 const encoded=JSON.stringify(input.pairs),now=Date.now();
 const result=input.revision===0
  ?await db().prepare('INSERT OR IGNORE INTO reader_pairs (church_id,user_id,service_id,version,data,revision,updated) SELECT ?,?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM services WHERE id=? AND church_id=? AND deleted=0)').bind(p.churchId,p.id,id,version,encoded,now,id,p.churchId).run()
  :await db().prepare('UPDATE reader_pairs SET data=?,revision=revision+1,updated=? WHERE church_id=? AND user_id=? AND service_id=? AND version=? AND revision=? AND EXISTS(SELECT 1 FROM services WHERE id=? AND church_id=? AND deleted=0)').bind(encoded,now,p.churchId,p.id,id,version,input.revision,id,p.churchId).run();
 if(!result.meta.changes)fail(409,'다른 기기에서 설정이 변경되었습니다. 저장된 설정을 다시 불러와 주세요.');
 return json({pairs:input.pairs,version,basedVersion:version,revision:input.revision+1,removed:0});
}
