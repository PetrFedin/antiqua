// ANTIQUA v90 — lossless display for integer minor units.
// Mirrors the authoritative finance engine's currency exponents; a parity
// regression against money-v15.mjs must reject any drift.
const EXPONENTS=new Map([
 ['BHD',3],['IQD',3],['JOD',3],['KWD',3],['LYD',3],['OMR',3],['TND',3],
 ['BIF',0],['CLP',0],['DJF',0],['GNF',0],['ISK',0],['JPY',0],
 ['KMF',0],['KRW',0],['PYG',0],['RWF',0],['UGX',0],['VND',0],
 ['VUV',0],['XAF',0],['XOF',0],['XPF',0]
]);
export const currencyScaleV90=code=>{
 const v=String(code||'').toUpperCase();
 if(!/^[A-Z]{3}$/.test(v))throw new RangeError('Invalid currency');
 return EXPONENTS.get(v)??2;
};
export function formatMinorCurrencyExactV90(amountMinor,currency,locale='ru-RU'){
 const code=String(currency||'').toUpperCase();
 const scale=currencyScaleV90(code);
 const amount=typeof amountMinor==='string'&&/^\d+$/.test(amountMinor)?
  Number(amountMinor):amountMinor;
 if(!Number.isSafeInteger(amount)||amount<0)
  throw new RangeError('Invalid monetary minor units');
 const factor=10n**BigInt(scale),minor=BigInt(amount),whole=minor/factor;
 const remainder=scale?String(minor%factor).padStart(scale,'0'):'';
 const formatter=new Intl.NumberFormat(locale,{
  style:'currency',currency:code,minimumFractionDigits:scale,
  maximumFractionDigits:scale
 });
 return formatter.formatToParts(whole).map(part=>
  part.type==='fraction'?remainder:part.value).join('');
}
