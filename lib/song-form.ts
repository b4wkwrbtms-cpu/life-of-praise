import type {Layout,Section,SectionMarker,Song} from './types';

export type SongFormPatch={form:Section[];layout:Layout;markers:SectionMarker[];pageLayouts:{pageId:string;layout?:Layout}[]};
export function songFormPatch(song:Song):SongFormPatch{return {form:song.form,layout:song.layout,markers:song.markers||[],pageLayouts:song.pages.map(p=>({pageId:p.id,...(p.layout?{layout:p.layout}:{})}))}}
export function sameSongForm(a:Song,b:Song){return JSON.stringify(songFormPatch(a))===JSON.stringify(songFormPatch(b))}
export function applySongForm(song:Song,patch:SongFormPatch):Song{
 return {...song,form:patch.form,layout:patch.layout,markers:patch.markers,pages:song.pages.map(p=>{const layout=patch.pageLayouts.find(l=>l.pageId===p.id)?.layout;const next={...p};if(layout)next.layout=layout;else delete next.layout;return next}),exports:[],renderOnRead:true};
}
