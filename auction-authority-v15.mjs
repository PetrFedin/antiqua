import {db,auctions,publicAuction,step} from './runtime-v09.mjs';

const iso=v=>v?.toISOString?.()||v||null;

function fromRow(r){
  const s=r.state||{},starts=r.starts_at??s.startsAt,ends=r.ends_at??s.endsAt;
  const currentBid=Number(r.current_bid??s.currentBid??0),reservePrice=Number(r.reserve_price??s.reservePrice??0);
  const now=Date.now(),startMs=Date.parse(iso(starts)||''),endMs=Date.parse(iso(ends)||'');
  const state=r.status==='CLOSED'||Number.isFinite(endMs)&&now>=endMs?'CLOSED':Number.isFinite(startMs)&&now<startMs?'SCHEDULED':'LIVE';
  return {
    id:r.id,
    saleId:r.sale_id??s.saleId,
    lotId:r.object_id??s.lotId,
    currency:s.currency||'EUR',
    currentBid,
    increment:Number(r.increment??s.increment??step(currentBid)),
    bidCount:Number(r.bid_count??s.bidCount??0),
    reserveMet:currentBid>=reservePrice,
    startsAt:iso(starts),
    endsAt:iso(ends),
    state,
    history:Array.isArray(s.history)?s.history.slice(-12):[]
  };
}

export async function listAuthoritativePublicAuctions(){
  if(db.kind!=='POSTGRES')return auctions.map(publicAuction);
  const rows=(await db.pool.query(`SELECT id,object_id,sale_id,status,current_bid,increment,bid_count,reserve_price,starts_at,ends_at,state
    FROM auctions ORDER BY id`)).rows;
  return rows.map(fromRow);
}

export async function getAuthoritativePublicAuction(id){
  if(db.kind!=='POSTGRES'){
    const a=auctions.find(x=>x.id===id);
    return a?publicAuction(a):null;
  }
  const row=(await db.pool.query(`SELECT id,object_id,sale_id,status,current_bid,increment,bid_count,reserve_price,starts_at,ends_at,state
    FROM auctions WHERE id=$1`,[id])).rows[0];
  return row?fromRow(row):null;
}

export async function getAuthoritativePublicAuctionForObject(objectId){
  if(db.kind!=='POSTGRES'){
    const a=auctions.find(x=>x.lotId===objectId);
    return a?publicAuction(a):null;
  }
  const row=(await db.pool.query(`SELECT id,object_id,sale_id,status,current_bid,increment,bid_count,reserve_price,starts_at,ends_at,state
    FROM auctions WHERE object_id=$1 ORDER BY ends_at DESC LIMIT 1`,[objectId])).rows[0];
  return row?fromRow(row):null;
}
