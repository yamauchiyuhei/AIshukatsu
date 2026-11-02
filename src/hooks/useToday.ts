import { useEffect, useState } from 'react';
import { localDateKey } from '../lib/cellValues';
export function useToday() {
  const [today,setToday]=useState(()=>localDateKey(new Date()));
  useEffect(()=>{
    const tick=()=>setToday(localDateKey(new Date()));
    const interval=setInterval(tick,30000);window.addEventListener('focus',tick);
    return()=>{clearInterval(interval);window.removeEventListener('focus',tick);};
  },[]);
  return today;
}
