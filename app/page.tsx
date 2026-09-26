import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import PraiseApp from './praise-app';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;const invite=typeof params.invite==='string'?params.invite.slice(0,100):'';const user=await getChatGPTUser();return <PraiseApp signedIn={!!user} signInPath={chatGPTSignInPath(invite?'/?invite='+encodeURIComponent(invite):'/')} />;}
