// A gateway or expired login can return HTML. Keep its contents out of errors.
export async function readApiResponse<T=any>(response:Response):Promise<T>{
 let data:any;
 try {data=await response.json();}catch {
  const status=response.status===401||response.redirected?401:response.ok?502:response.status;
  throw Object.assign(new Error(status===401?'로그인이 만료되었습니다. 같은 계정으로 다시 로그인해 주세요.':'서버 응답을 확인하지 못했습니다. 잠시 후 다시 연결해 주세요.'),{status});
 }
 if(!response.ok)throw Object.assign(new Error(response.status===401?'로그인이 만료되었습니다. 같은 계정으로 다시 로그인해 주세요.':typeof data?.error==='string'?data.error:'요청을 완료하지 못했습니다.'),{status:response.status});
 return data as T;
}
