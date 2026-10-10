// Navigation hints only. Invitation validity and every role are checked by the server.
export type Entry = {role:'team'|'leader';code:string;issue:string};
export function readEntry(params:URLSearchParams):Entry {
 const team=params.getAll('invite'),leader=params.getAll('leader');
 const role=leader.length||params.get('join')==='leader'?'leader':'team';
 if(team.length+leader.length>1)return {role,code:'',issue:'초대 정보가 겹쳐 있습니다. 받은 초대 링크 하나를 다시 열어 주세요.'};
 const code=(leader[0]??team[0]??'').trim();
 if((team.length||leader.length)&&(!code||code.length>100))return {role,code:'',issue:'초대 코드가 비어 있거나 너무 깁니다. 초대 링크를 다시 확인해 주세요.'};
 return {role:team.length?'team':role,code,issue:''};
}
export function entryReturnPath(entry:Pick<Entry,'role'|'code'>):string {
 const query=new URLSearchParams();
 if(entry.code)query.set(entry.role==='leader'?'leader':'invite',entry.code.trim());
 else if(entry.role==='leader')query.set('join','leader');
 return query.size?'/?'+query.toString():'/';
}
export function safeRelativeReturnPath(value:string):string {
 if(!value.startsWith('/')||value.startsWith('//'))return '/';
 try {
  const url=new URL(value,'https://app.local');
  if(url.origin!=='https://app.local'||['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname))return '/';
  return url.pathname+url.search+url.hash;
 }catch{return '/';}
}
export function signInPath(returnTo:string){return '/signin-with-chatgpt?return_to='+encodeURIComponent(safeRelativeReturnPath(returnTo));}
export function signOutPath(returnTo='/'){return '/signout-with-chatgpt?return_to='+encodeURIComponent(safeRelativeReturnPath(returnTo));}
