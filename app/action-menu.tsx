'use client';
import {MoreHorizontal} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';

export type MenuAction={label:string;run:()=>void;destructive?:boolean};
export default function ActionMenu({label,items,disabled=false}:{label:string;items:MenuAction[];disabled?:boolean}){
 if(!items.length)return null;
 return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="secondary action-menu-trigger" aria-label={label} disabled={disabled}><MoreHorizontal size={20} aria-hidden="true"/><span>더보기</span></button></DropdownMenuTrigger>
  <DropdownMenuContent className="workspace-action-menu" align="end" sideOffset={8}>{items.map(item=><DropdownMenuItem key={item.label} disabled={disabled} variant={item.destructive?'destructive':'default'} onSelect={item.run}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent>
 </DropdownMenu>;
}
