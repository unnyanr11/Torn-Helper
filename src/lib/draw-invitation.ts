const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Fixed in-app destination only; no arbitrary return URL or external redirect. */
export function drawInvitation(href:string):string|null {
 try{
  const url=new URL(href),hash=url.hash.replace(/^#\/?/,'');
  const page=decodeURIComponent(hash.split('?')[0]);
  if(page&&page!=='Lucky Draws')return null;
  const id=new URLSearchParams(hash.split('?')[1]??'').get('campaign')??url.searchParams.get('draw');
  return id&&UUID.test(id)?id.toLowerCase():null;
 }catch{return null;}
}
export function drawInvitationLink(href:string,campaign:string){
 if(!UUID.test(campaign))throw new Error('Invalid campaign');
 const url=new URL(href);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid website');
 url.hash='';url.search='';url.searchParams.set('draw',campaign.toLowerCase());return url.href;
}
