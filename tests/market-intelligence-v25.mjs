import assert from 'node:assert/strict';
import {buildMarketIntelligence,marketIntelligenceCapabilities} from '../market-intelligence-v25.mjs';

const bi=(en,ru)=>({en,ru});
const source={id:'source',objectId:'AQ-SOURCE',title:bi('Walnut commode','Ореховый комод'),department:bi('European Furniture','Европейская мебель'),maker:bi('Maker A','Мастер A'),period:bi('18th century','XVIII век'),origin:bi('France','Франция'),materials:bi('Walnut, gilt bronze','Орех, золочёная бронза')};
const object=(id,overrides={})=>({id,objectId:'AQ-'+id,title:bi('Comparable '+id,'Сравнение '+id),department:bi('European Furniture','Европейская мебель'),maker:bi('Maker A','Мастер A'),period:bi('late 18th century','конец XVIII века'),origin:bi('France','Франция'),materials:bi('Walnut, gilt bronze','Орех, золочёная бронза'),...overrides});
const result=(id,status,hammer,realized,currency='EUR',endedAt='2026-09-20T12:00:00.000Z')=>({auctionId:'auc-'+id,objectId:id,currency,bidCount:5,endedAt,auctionState:'CLOSED',status,final:status==='SOLD',hammerAmountMinor:hammer,realizedAmountMinor:realized});
const auction=id=>({id:'auc-'+id,lotId:id,saleId:'sale-'+id,state:'CLOSED'});

const records=[
 {object:object('sold-1'),auction:auction('sold-1'),result:result('sold-1','SOLD',800000,800000)},
 {object:object('sold-2',{maker:bi('Maker B','Мастер B')}),auction:auction('sold-2'),result:result('sold-2','SOLD',1200000,1200000)},
 {object:object('hammer'),auction:auction('hammer'),result:result('hammer','HAMMERED',2000000,null)},
 {object:object('usd'),auction:auction('usd'),result:result('usd','SOLD',500000,500000,'USD')},
 {object:object('weak',{department:bi('Sculpture','Скульптура'),maker:bi('Other','Другой'),period:bi('20th century','XX век'),origin:bi('Italy','Италия'),materials:bi('Marble','Мрамор')}),auction:auction('weak'),result:result('weak','SOLD',9900000,9900000)}
];

const x=buildMarketIntelligence(source,records,{limit:20});
assert.equal(x.items.length,4,'catalogue-unrelated result must not enter comparables');
assert.equal(x.items[0].objectId,'sold-1','strongest catalogue match must rank first');
assert.equal(x.items.find(v=>v.objectId==='hammer').realizedAmountMinor,null);
assert.equal(x.items.find(v=>v.objectId==='hammer').hammerAmountMinor,2000000);
assert.deepEqual(x.summary.realizedByCurrency.EUR,{count:2,minMinor:800000,medianMinor:1000000,maxMinor:1200000});
assert.deepEqual(x.summary.realizedByCurrency.USD,{count:1,minMinor:500000,medianMinor:500000,maxMinor:500000});
assert.equal(x.summary.realizedByCurrency.EUR.maxMinor,1200000,'hammer-only value must not contaminate realized range');
assert.equal(x.items.every(v=>v.source?.name==='ANTIQUA'),true);
assert.equal(x.items.every(v=>Array.isArray(v.reasons)&&v.reasons.length>0),true);
assert.equal(JSON.stringify(x).includes('score'),false,'opaque score must not appear');

const cap=marketIntelligenceCapabilities();
assert.equal(cap.priceUsedForMatching,false);
assert.equal(cap.realizedStatsSoldOnly,true);
assert.equal(cap.hammerVsRealizedSeparated,true);
assert.equal(cap.crossCurrencyAggregation,false);
assert.equal(cap.opaqueScore,false);
assert.equal(cap.externalSources,false);
console.log('ANTIQUA v25 market intelligence: catalogue comparability + hammer/realized separation + currency-safe realized ranges passed');
