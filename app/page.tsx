import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import PraiseApp from './praise-app';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const query=new URLSearchParams();for(const key of ['invite','leader'])if(typeof params[key]==='string')query.set(key,(params[key] as string).slice(0,100));const user=await getChatGPTUser();return <PraiseApp signedIn={!!user} signInPath={chatGPTSignInPath(query.size?'/?'+query.toString():'/')} />;}
