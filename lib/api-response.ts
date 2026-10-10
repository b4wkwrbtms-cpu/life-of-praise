// A gateway or expired login can return HTML. Keep its contents out of errors.
export async function requestJson<T=any>(url:string,init:RequestInit={},timeoutMs=30_000):Promise<T>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try {
  return await readApiResponse<T>(await fetch(url,{...init,signal:controller.signal}));
 }catch(error){
  if(controller.signal.aborted)throw Object.assign(new Error(init.method&&init.method!=='GET'?'응답이 늦어지고 있습니다. 저장되었을 수 있으니 목록이나 저장 상태를 확인한 뒤 다시 시도해 주세요.':'연결 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'),{status:408});
  if(error instanceof TypeError)throw Object.assign(new Error('네트워크에 연결하지 못했습니다. 연결 상태를 확인해 주세요.'),{status:0});
  throw error;
 }finally{clearTimeout(timer)}
}

export async function readApiResponse<T=any>(response:Response):Promise<T>{
 let data:any;
 try {data=await response.json();}catch {
  const status=response.status===401||response.redirected?401:response.ok?502:response.status;
  throw Object.assign(new Error(status===401?'로그인이 만료되었습니다. 같은 계정으로 다시 로그인해 주세요.':'서버 응답을 확인하지 못했습니다. 잠시 후 다시 연결해 주세요.'),{status});
 }
 if(!response.ok)throw Object.assign(new Error(response.status===401?'로그인이 만료되었습니다. 같은 계정으로 다시 로그인해 주세요.':typeof data?.error==='string'?data.error:'요청을 완료하지 못했습니다.'),{status:response.status});
 return data as T;
}
