const PUBLIC_EXHIBITION_STATUSES=new Set(['SCHEDULED','LIVE','ARCHIVED']);

export function isPublicCollection(resource){
  return Boolean(resource&&resource.visibility==='PUBLIC');
}

export function isPublicEnsemble(resource){
  return Boolean(resource&&resource.visibility==='PUBLIC'&&resource.status==='ACTIVE');
}

export function isPublicExhibition(resource){
  return Boolean(resource&&resource.visibility==='PUBLIC'&&PUBLIC_EXHIBITION_STATUSES.has(resource.status));
}

export function canReadCollection(resource,accountId=null){
  if(!resource)return false;
  if(isPublicCollection(resource))return true;
  return Boolean(accountId&&resource.ownerAccountId&&resource.ownerAccountId===accountId);
}

export function canReadExhibition(resource,{owner=false}={}){
  if(!resource)return false;
  return isPublicExhibition(resource)||owner===true;
}
