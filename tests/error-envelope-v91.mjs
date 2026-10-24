import assert from 'node:assert/strict';
import {httpErrorEnvelopeV91} from '../error-envelope-v91.mjs';

const secret='SECRET_DATABASE_URL_postgresql_superuser_token';
const raw=new Error(secret);
raw.code='28P01';
let result=httpErrorEnvelopeV91(raw);
assert.equal(result.status,500);
assert.deepEqual(result.body,{error:'Unexpected server error',code:'INTERNAL_ERROR'});
assert.ok(!JSON.stringify(result).includes(secret));

result=httpErrorEnvelopeV91({status:503,code:'SECRET_CONNECTION',message:secret,
 minimum:777,missing:['SECRET_TENANT']});
assert.deepEqual(result,{status:503,body:{
 error:'Service temporarily unavailable',code:'SERVICE_UNAVAILABLE'
}});
assert.ok(!JSON.stringify(result).includes(secret));

result=httpErrorEnvelopeV91({status:403,code:'FORBIDDEN',message:'Permission required'});
assert.deepEqual(result,{status:403,body:{error:'Permission required',code:'FORBIDDEN'}});
result=httpErrorEnvelopeV91({status:409,code:'TWO_FACTOR_ALREADY_ENABLED',
 message:'Two-factor authentication is already enabled'});
assert.equal(result.status,409);
assert.equal(result.body.code,'TWO_FACTOR_ALREADY_ENABLED');

result=httpErrorEnvelopeV91({status:400,message:'Wrong input',code:'INVALID_INPUT',
 minimum:3,missing:['LOT_ID','SELLER_ID']});
assert.deepEqual(result.body,{
 error:'Wrong input',code:'INVALID_INPUT',minimum:3,missing:['LOT_ID','SELLER_ID']
});
assert.equal('missing' in httpErrorEnvelopeV91({status:400,missing:[secret]}).body,false);
assert.equal('minimum' in httpErrorEnvelopeV91({status:400,minimum:-2}).body,false);
assert.equal('code' in httpErrorEnvelopeV91({status:400,code:'../../etc/passwd'}).body,false);
assert.equal(httpErrorEnvelopeV91({status:204,message:'Internal'}).status,500);
assert.equal(httpErrorEnvelopeV91(null).status,500);
console.log('ANTIQUA v91 unexpected HTTP error redaction and expected 4xx contracts PASS');
