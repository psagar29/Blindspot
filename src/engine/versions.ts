// Entity identity is stable. Identical retries reuse the immutable stored version.
function canonical(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function nextSnapshot<T extends {id:string;version:number}>(proposed:T,previous:T|null):T {
  if(previous&&previous.id!==proposed.id)throw new Error('Cannot advance a different entity.');
  if(previous&&canonical({...proposed,version:0})===canonical({...previous,version:0}))return previous;
  return {...proposed,version:(previous?.version??0)+1};
}
