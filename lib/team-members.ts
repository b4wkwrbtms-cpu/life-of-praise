import type {Profile} from './types';
export type TeamMember=Profile&{accountActive?:number;devices?:{platform:string;installedAt:number|null;launchedAt:number|null}[]};
export function teamGroups(members:TeamMember[],query=''){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const matches=(member:TeamMember)=>terms.every(term=>(member.name+' '+member.position+' '+(member.role==='admin'?'인도자':'찬양팀')).toLocaleLowerCase().includes(term));
 const active=members.filter(member=>member.active),inactive=members.filter(member=>!member.active);
 return {active:active.filter(matches),inactive:inactive.filter(matches),activeCount:active.length,inactiveCount:inactive.length,launchedCount:active.filter(member=>member.devices?.some(device=>device.launchedAt)).length};
}
