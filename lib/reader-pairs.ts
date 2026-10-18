import type {ReaderPage} from './reader-layout';
export type ReaderPageRef={songId:string;pageId:string};
export type ReaderPair=[ReaderPageRef,ReaderPageRef];
export type ReaderPairSettings={pairs:ReaderPair[];revision:number;version:number;basedVersion:number;removed:number};
export const readerPageKey=(page:ReaderPageRef)=>JSON.stringify([page.songId,page.pageId]);
export const readerPageRef=(page:ReaderPage):ReaderPageRef=>({songId:page.song.id,pageId:page.page.id});

// A page is identified by both song and file: imported songs can share a file.
export function validReaderPairs(pages:ReaderPage[],pairs:ReaderPair[]){
 const available=new Set(pages.map(page=>readerPageKey(readerPageRef(page)))),used=new Set<string>();
 const valid:ReaderPair[]=[];
 for(const pair of pairs){
  const [a,b]=pair.map(readerPageKey);
  if(a===b||!available.has(a)||!available.has(b)||used.has(a)||used.has(b))continue;
  valid.push(pair);used.add(a);used.add(b);
 }
 return {pairs:valid,removed:pairs.length-valid.length};
}
export function personalReaderSpreads(pages:ReaderPage[],pairs:ReaderPair[]):number[][]{
 const keys=pages.map(page=>readerPageKey(readerPageRef(page))),groups=new Map<number,number[]>(),used=new Set<number>();
 for(const pair of validReaderPairs(pages,pairs).pairs){
  const indices=pair.map(ref=>keys.indexOf(readerPageKey(ref)));
  groups.set(Math.min(...indices),indices);indices.forEach(index=>used.add(index));
 }
 return pages.flatMap((_,index)=>groups.has(index)?[groups.get(index)!]:used.has(index)?[]:[[index]]);
}
export function personalReaderFrame(index:number,spreads:number[][]){
 const position=Math.max(0,spreads.findIndex(group=>group.includes(index))),indices=spreads[position]||[];
 const previousIndex=position>0?Math.min(...spreads[position-1]):null,nextIndex=position<spreads.length-1?Math.min(...spreads[position+1]):null;
 return {indices,start:indices.length?Math.min(...indices):0,previousIndex,nextIndex,lastIndex:spreads.length?Math.min(...spreads[spreads.length-1]):0,
  label:indices.map(i=>i+1).join(' + ')||'0'};
}
