const CURRENCY_EXPONENTS=new Map([
  ['BHD',3],['IQD',3],['JOD',3],['KWD',3],['LYD',3],['OMR',3],['TND',3],
  ['BIF',0],['CLP',0],['DJF',0],['GNF',0],['ISK',0],['JPY',0],['KMF',0],['KRW',0],['PYG',0],['RWF',0],['UGX',0],['VND',0],['VUV',0],['XAF',0],['XOF',0],['XPF',0]
]);

const moneyError=(message,code)=>Object.assign(new Error(message),{status:400,code});

export function normalizeCurrency(value){
  const currency=String(value||'').trim().toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency))throw moneyError('Invalid currency','INVALID_CURRENCY');
  return currency;
}

export function currencyExponent(value){
  const currency=normalizeCurrency(value);
  return CURRENCY_EXPONENTS.get(currency)??2;
}

export function assertMinorAmount(value,{allowZero=true,name='amountMinor'}={}){
  if(typeof value==='bigint'){
    if(value<0n||(!allowZero&&value===0n))throw moneyError(`${name} must be ${allowZero?'non-negative':'positive'}`,'INVALID_MONEY_AMOUNT');
    if(value>BigInt(Number.MAX_SAFE_INTEGER))throw moneyError(`${name} exceeds safe integer range`,'MONEY_AMOUNT_TOO_LARGE');
    return Number(value);
  }
  const amount=typeof value==='string'&&/^\d+$/.test(value.trim())?Number(value):value;
  if(!Number.isSafeInteger(amount))throw moneyError(`${name} must be a safe integer in minor units`,'INVALID_MINOR_UNITS');
  if(amount<0||(!allowZero&&amount===0))throw moneyError(`${name} must be ${allowZero?'non-negative':'positive'}`,'INVALID_MONEY_AMOUNT');
  return amount;
}

export function majorToMinor(value,currency){
  const code=normalizeCurrency(currency),scale=currencyExponent(code);
  if(typeof value==='bigint'){
    const factor=10n**BigInt(scale),minor=value*factor;
    return assertMinorAmount(minor,{name:'major amount'});
  }
  const raw=String(value??'').trim();
  const match=raw.match(/^(\+)?(\d+)(?:\.(\d+))?$/);
  if(!match)throw moneyError('Major amount must be a non-negative decimal value','INVALID_MAJOR_UNITS');
  const whole=match[2],fraction=match[3]||'';
  if(fraction.length>scale&&/[1-9]/.test(fraction.slice(scale)))throw moneyError(`Too many decimal places for ${code}`,'MONEY_SCALE_EXCEEDED');
  const padded=fraction.slice(0,scale).padEnd(scale,'0');
  const factor=10n**BigInt(scale),minor=BigInt(whole)*factor+BigInt(padded||'0');
  return assertMinorAmount(minor,{name:'major amount'});
}

export function moneyFromMinor(amountMinor,currency){
  return Object.freeze({amountMinor:assertMinorAmount(amountMinor),currency:normalizeCurrency(currency)});
}

export function moneyFromMajor(amount,currency){
  const code=normalizeCurrency(currency);
  return moneyFromMinor(majorToMinor(amount,code),code);
}

export function sameMoney(a,b){
  return Boolean(a&&b&&normalizeCurrency(a.currency)===normalizeCurrency(b.currency)&&assertMinorAmount(a.amountMinor)===assertMinorAmount(b.amountMinor));
}
