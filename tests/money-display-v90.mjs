import assert from 'node:assert/strict';
import {currencyExponent} from '../money-v15.mjs';
import {currencyScaleV90,formatMinorCurrencyExactV90} from '../public/modules/money-display.js';
const ISO_SET='AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG'.split(' ');
for(const code of ISO_SET)assert.equal(currencyScaleV90(code),currencyExponent(code),
 'browser currency scale drift: '+code);
assert.match(formatMinorCurrencyExactV90(12345,'EUR','en-GB'),/123\.45/);
assert.match(formatMinorCurrencyExactV90(987,'JPY','en-GB'),/987/);
assert.doesNotMatch(formatMinorCurrencyExactV90(987,'JPY','en-GB'),/[.,]00\b/);
assert.match(formatMinorCurrencyExactV90(12345,'KWD','en-GB'),/12\.345/);
assert.match(formatMinorCurrencyExactV90(987654,'BHD','en-GB'),/987\.654/);
assert.match(formatMinorCurrencyExactV90(9007199254740991,'EUR','en-GB'),/90,071,992,547,409\.91/,
 'maximum safe minor value retains exact last cent, no floating conversion');
assert.equal(formatMinorCurrencyExactV90(100,'EUR','ru-RU').includes('1,00'),true);
assert.throws(()=>formatMinorCurrencyExactV90(-1,'EUR'),RangeError);
assert.throws(()=>formatMinorCurrencyExactV90(1.2,'EUR'),RangeError);
assert.throws(()=>formatMinorCurrencyExactV90('1e4','EUR'),RangeError);
assert.throws(()=>formatMinorCurrencyExactV90('123','INVALID'),RangeError);
console.log('ANTIQUA v90 browser money: source engine exponent parity and lossless 0/2/3-decimal and huge-value display PASS');
