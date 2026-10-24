// ANTIQUA v91: no raw database/provider/internal exceptions over HTTP.
// Expected, explicitly authored client errors retain actionable codes.
const SAFE_CODE=/^[A-Z][A-Z0-9_]{1,79}$/;
export function httpErrorEnvelopeV91(error){
 const n=error?.status;
 const status=Number.isInteger(n)&&n>=400&&n<=599?n:500;
 if(status>=500)return{
  status,
  body:{
   error:status===503?'Service temporarily unavailable':'Unexpected server error',
   code:status===503?'SERVICE_UNAVAILABLE':'INTERNAL_ERROR'
  }
 };
 const message=typeof error?.message==='string'&&error.message.trim()?
  error.message.slice(0,240):'Request could not be completed';
 const body={error:message};
 if(typeof error?.code==='string'&&SAFE_CODE.test(error.code))body.code=error.code;
 if(Number.isSafeInteger(error?.minimum)&&error.minimum>=0)body.minimum=error.minimum;
 if(Array.isArray(error?.missing)&&error.missing.length<=20&&
  error.missing.every(x=>typeof x==='string'&&SAFE_CODE.test(x)))
   body.missing=[...error.missing];
 return{status,body};
}
