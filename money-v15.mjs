const ZERO_DECIMAL=new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
const THREE_DECIMAL=new Set(['BHD','IQD','JOD','KWD','LYD','OMR','TND']);
const MAX_SAFE_MINOR=BigInt(Number.MAX_SAFE_INTEGER);

export function normalizeCurrency(value='EUR'){
  const currency=String(value||'').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency))throw Object.assign(new Error('Invalid currency'),{status:400,code:'INVALID_CURRENCY'});
  return currency;
}

export function currencyExponent(currency){
  const code=normalizeCurrency(currency);
  if(ZERO_DECIMAL.has(code))return 0;
  if(THREE_DECIMAL.has(code))return 3;
  return 2;
}

export function assertMinorAmount(value,{allowZero=false}={}){
  const n=typeof value==='string'&&/^\d+$/.test(value)?Number(value):value;
  if(!Number.isSafeInteger(n)||n<0||(!allowZero&&n===0))throw Object.assign(new Error('Invalid minor-unit amount'),{status:400,code:'INVALID_MONEY_AMOUNT'});
  return n;
}

export function majorToMinor(value,currency='EUR'){
  const code=normalizeCurrency(currency),exponent=currencyExponent(code),raw=String(value??'').trim();
  if(!/^\d+(?:\.\d+)?$/.test(raw))throw Object.assign(new Error('Invalid major-unit amount'),{status:400,code:'INVALID_MONEY_AMOUNT'});
  const [whole,fraction='']=raw.split('.');
  if(fraction.length>exponent)throw Object.assign(new Error(`Too many decimal places for ${code}`),{status:400,code:'INVALID_MONEY_PRECISION'});
  const scale=10n**BigInt(exponent),minor=BigInt(whole)*scale+BigInt((fraction+'0'.repeat(exponent)).slice(0,exponent)||'0');
  if(minor>MAX_SAFE_MINOR)throw Object.assign(new Error('Money amount exceeds safe integer range'),{status:400,code:'MONEY_AMOUNT_TOO_LARGE'});
  return assertMinorAmount(Number(minor),{allowZero:true});
}

export function minorToMajorString(value,currency='EUR'){
  const code=normalizeCurrency(currency),minor=assertMinorAmount(value,{allowZero:true}),exponent=currencyExponent(code);
  if(exponent===0)return String(minor);
  const scale=10**exponent,whole=Math.floor(minor/scale),fraction=String(minor%scale).padStart(exponent,'0');
  return `${whole}.${fraction}`;
}

export function moneyFromMinor(amountMinor,currency='EUR'){
  return Object.freeze({amountMinor:assertMinorAmount(amountMinor,{allowZero:true}),currency:normalizeCurrency(currency)});
}

export function moneyFromMajor(amount,currency='EUR'){
  const code=normalizeCurrency(currency);
  return moneyFromMinor(majorToMinor(amount,code),code);
}
