import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import {readEntry,entryReturnPath} from '@/lib/entry';
import PraiseApp from './praise-app';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,query=new URLSearchParams();
 for(const key of ['invite','leader','join'])for(const value of [params[key]].flat())if(typeof value==='string')query.append(key,value);
 const entry=readEntry(query),user=await getChatGPTUser();
 const notice=typeof params.notice==='string'&&/^[a-f0-9-]{36}$/.test(params.notice)?params.notice:'';
 const returnTo=!entry.code&&entry.role==='team'&&notice?'/?notice='+notice:entryReturnPath(entry);
 return <PraiseApp signedIn={!!user} entry={entry} signInPath={chatGPTSignInPath(returnTo)}/>;
}
