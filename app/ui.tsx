'use client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {LoaderCircle} from 'lucide-react';
export function Picker({value,onChange,options,label}:{value:string;onChange:(s:string)=>void;options:{value:string;label:string}[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger className="picker" aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>}
export function Field({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function Busy({text='불러오는 중…'}:{text?:string}){return <div className="busy" role="status"><LoaderCircle className="spin" size={20}/>{text}</div>}
export function Mark({small=false}:{small?:boolean}){return <span className={'brand-mark '+(small?'small':'')} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 5v22M8 13h16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/></svg></span>}
