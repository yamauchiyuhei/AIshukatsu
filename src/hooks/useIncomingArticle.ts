import { useEffect, useState } from 'react';
import { isTauri } from '../lib/tauriFsaShim';
import { researchRequests, type ResearchRequest } from '../lib/researchRequests';
export function useIncomingArticle() {
  const desktop = isTauri();
  const [request,setRequest] = useState<ResearchRequest|null>(() => {
    if (desktop) return researchRequests.current();
    const slug = new URLSearchParams(window.location.search).get('article');
    return slug ? {id:'web:'+slug,slug,receivedAt:Date.now()} : null;
  });
  useEffect(() => {
    if (!desktop) return;
    const update = () => setRequest(researchRequests.current());
    const unsubscribe = researchRequests.subscribe(update);update();return unsubscribe;
  },[desktop]);
  const complete = (id: string) => {
    if (desktop) researchRequests.complete(id);
    else { setRequest(null); const url = new URL(window.location.href);url.searchParams.delete('article');window.history.replaceState(null,'',url.pathname+url.search+url.hash); }
  };
  return {request,complete};
}
