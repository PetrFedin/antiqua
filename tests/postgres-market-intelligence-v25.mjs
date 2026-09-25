import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {db} from '../runtime-v09.mjs';
import {marketIntelligenceFor,listPublicMarketResults} from '../market-intelligence-v25.mjs';

if(!process.env.DATABASE_URL){console.log('ANTIQUA v25 PostgreSQL market intelligence: skipped (DATABASE_URL not set)');process.exit(0)}
assert.equal(db.kind,'POSTGRES');
const buyer=await db.findAccountByEmail('buyer@demo.antiqua');assert.ok(buyer?.id);
const token=crypto.randomUUID().replaceAll('-','').slice(0,12),started=new Date(Date.now()-7200_000).toISOString(),ended=new Date(Date.now()-3600_000).toISOString();
const ids={
 source:'mi-source-'+token,sold1:'mi-sold1-'+token,hammer:'mi-hammer-'+token,usd:'mi-usd-'+token,private:'mi-private-'+token
};
const auctions={sold1:'mi-auc-sold1-'+token,hammer:'mi-auc-hammer-'+token,usd:'mi-auc-usd-'+token,private:'mi-auc-private-'+token};
const settlements={sold1:'mi-set-sold1-'+token,hammer:'mi-set-hammer-'+token,usd:'mi-set-usd-'+token,private:'mi-set-private-'+token};
const passport=(id,title,overrides={})=>({id,objectId:'AQ-'+id,title:{en:title,ru:title},department:{en:'European Furniture',ru:'Европейская мебель'},maker:{en:'Maker A',ru:'Мастер A'},period:{en:'18th century',ru:'XVIII век'},origin:{en:'France',ru:'Франция'},materials:{en:'Walnut, gilt bronze',ru:'Орех, золочёная бронза'},currency:'EUR',...overrides});
try{
 await db.pool.query("INSERT INTO objects(id,object_code,passport,catalogue_status,trust_status,publication_status) VALUES($1,$2,$3,'APPROVED','CLEARED','PUBLIC'),($4,$5,$6,'APPROVED','CLEARED','PUBLIC'),($7,$8,$9,'APPROVED','CLEARED','PUBLIC'),($10,$11,$12,'APPROVED','CLEARED','PUBLIC'),($13,$14,$15,'APPROVED','CLEARED','PRIVATE')",[
  ids.source,'AQ-'+ids.source,passport(ids.source,'Market source'),
  ids.sold1,'AQ-'+ids.sold1,passport(ids.sold1,'Sold comparable one'),
  ids.hammer,'AQ-'+ids.hammer,passport(ids.hammer,'Hammer comparable',{maker:{en:'Maker B',ru:'Мастер B'}}),
  ids.usd,'AQ-'+ids.usd,passport(ids.usd,'USD comparable',{currency:'USD'}),
  ids.private,'AQ-'+ids.private,passport(ids.private,'Private comparable')
 ]);
 const state=(currency,currentBid,bidCount)=>({currency,currentBid,bidCount,endsAt:ended,startsAt:started,state:'CLOSED'});
 await db.pool.query("INSERT INTO auctions(id,object_id,sale_id,status,current_bid,ends_at,state,baseline_bid,reserve_price,increment,bid_count,leader_account_id,starts_at) VALUES($1,$2,'sale-mi','CLOSED',8000,$3,$4,6000,7000,250,7,$5,$6),($7,$8,'sale-mi','CLOSED',20000,$3,$9,15000,16000,500,9,$5,$6),($10,$11,'sale-mi','CLOSED',5000,$3,$12,4000,4500,100,4,$5,$6),($13,$14,'sale-mi-private','CLOSED',99000,$3,$15,80000,90000,1000,12,$5,$6)",[
  auctions.sold1,ids.sold1,ended,state('EUR',8000,7),buyer.id,started,
  auctions.hammer,ids.hammer,state('EUR',20000,9),
  auctions.usd,ids.usd,state('USD',5000,4),
  auctions.private,ids.private,state('EUR',99000,12)
 ]);
 await db.pool.query("INSERT INTO auction_settlements(id,auction_id,object_id,buyer_account_id,seller_id,winning_amount_minor,currency,status,payment_due_at,completed_at,metadata) VALUES($1,$2,$3,$4,NULL,800000,'EUR','COMPLETED',now(),now(),$5),($6,$7,$8,$4,NULL,2000000,'EUR','PAYMENT_DUE',now()+interval '2 days',NULL,$9),($10,$11,$12,$4,NULL,500000,'USD','COMPLETED',now(),now(),$13),($14,$15,$16,$4,NULL,9900000,'EUR','COMPLETED',now(),now(),$17)",[
  settlements.sold1,auctions.sold1,ids.sold1,buyer.id,{provider:'SECRET-1'},
  settlements.hammer,auctions.hammer,ids.hammer,{provider:'SECRET-2'},
  settlements.usd,auctions.usd,ids.usd,{provider:'SECRET-3'},
  settlements.private,auctions.private,ids.private,{provider:'SECRET-PRIVATE'}
 ]);

 const x=await marketIntelligenceFor(ids.source,{limit:20});
 assert.ok(x);assert.equal(x.items.length,3,'PRIVATE result must not enter public comparables');
 assert.equal(x.items.some(v=>v.objectId===ids.private),false);
 assert.equal(x.items.find(v=>v.objectId===ids.hammer).status,'HAMMERED');
 assert.equal(x.items.find(v=>v.objectId===ids.hammer).realizedAmountMinor,null);
 assert.deepEqual(x.summary.realizedByCurrency.EUR,{count:1,minMinor:800000,medianMinor:800000,maxMinor:800000});
 assert.deepEqual(x.summary.realizedByCurrency.USD,{count:1,minMinor:500000,medianMinor:500000,maxMinor:500000});
 assert.equal(x.summary.realizedByCurrency.EUR.maxMinor,800000,'HAMMERED 2m must not contaminate realized stats');
 assert.equal(x.items.every(v=>v.source.name==='ANTIQUA'),true);
 assert.equal(x.items.every(v=>v.reasons.length>0),true);

 const soldOnly=await listPublicMarketResults({status:'SOLD',limit:100});
 assert.equal(soldOnly.items.some(v=>v.objectId===ids.sold1),true);
 assert.equal(soldOnly.items.some(v=>v.objectId===ids.usd),true);
 assert.equal(soldOnly.items.some(v=>v.objectId===ids.hammer),false);
 assert.equal(soldOnly.items.some(v=>v.objectId===ids.private),false);
 const json=JSON.stringify({x,soldOnly});
 for(const secret of [buyer.id,...Object.values(settlements),'SECRET-1','SECRET-2','SECRET-3','SECRET-PRIVATE','buyerAccountId','settlementId','metadata'])assert.equal(json.includes(secret),false,'market intelligence leaked '+secret);
 console.log('ANTIQUA v25 PostgreSQL market intelligence: public boundary + SOLD-only realized stats + hammer separation + currency isolation passed');
}finally{
 await db.pool.query('DELETE FROM auction_settlements WHERE id=ANY($1::text[])',[Object.values(settlements)]).catch(()=>{});
 await db.pool.query('DELETE FROM auctions WHERE id=ANY($1::text[])',[Object.values(auctions)]).catch(()=>{});
 await db.pool.query('DELETE FROM objects WHERE id=ANY($1::text[])',[Object.values(ids)]).catch(()=>{});
 await db.pool.end()
}
