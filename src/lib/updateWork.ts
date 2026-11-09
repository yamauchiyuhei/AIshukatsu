import {useLayoutEffect} from 'react';
export interface UpdateWork {key:string;label:string;reveal?:()=>void}
const work=new Map<symbol,UpdateWork>();
/** Dialog drafts have not entered the save queue yet, so restart must wait for them. */
export function registerUpdateWork(item:UpdateWork){const owner=Symbol(item.key);work.set(owner,item);return()=>{work.delete(owner);};}
export function getUpdateWork(){return [...work.values()];}
export function useUpdateWork(key:string,active:boolean,label:string,reveal?:()=>void){useLayoutEffect(()=>active?registerUpdateWork({key,label,reveal}):undefined,[key,active,label,reveal]);}
