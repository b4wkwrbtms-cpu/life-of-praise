'use client';
import {useCallback,useLayoutEffect,useRef,useState} from 'react';

// Remember each tab only for the current account/church. Dialog navigation does
// not go through this hook, so closing a score retains the underlying list.
export function useWorkspaceNavigation(scope:string){
 const [tab,updateTab]=useState('week');
 const memory=useRef({scope,tab:'week',positions:new Map<string,number>(),pending:false});
 const navigate=useCallback((next:string,options?:{reset?:boolean})=>{
  const state=memory.current;
  if(next===state.tab){window.scrollTo({top:0,behavior:'instant'});return;}
  state.positions.set(state.tab,window.scrollY);
  if(options?.reset)state.positions.delete(next);
  state.pending=true;
  updateTab(next);
 },[]);
 useLayoutEffect(()=>{
  const state=memory.current;
  if(state.scope!==scope){state.scope=scope;state.positions.clear();state.pending=true;}
  state.tab=tab;
  if(state.pending){state.pending=false;window.scrollTo({top:state.positions.get(tab)||0,behavior:'instant'});}
 },[tab,scope]);
 return [tab,navigate] as const;
}
