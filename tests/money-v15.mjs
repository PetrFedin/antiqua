import assert from 'node:assert/strict';
import {assertMinorAmount,currencyExponent,majorToMinor,moneyFromMajor,moneyFromMinor,normalizeCurrency,sameMoney} from '../money-v15.mjs';

assert.equal(normalizeCurrency('eur'),'EUR');
assert.equal(currencyExponent('EUR'),2);
assert.equal(currencyExponent('JPY'),0);
assert.equal(currencyExponent('KWD'),3);

assert.equal(majorToMinor('8200','EUR'),820000);
assert.equal(majorToMinor('19.99','EUR'),1999);
assert.equal(majorToMinor('19.9','EUR'),1990);
assert.equal(majorToMinor(8200,'EUR'),820000);
assert.equal(majorToMinor('8200','JPY'),8200);
assert.equal(majorToMinor('1.234','KWD'),1234);
assert.equal(majorToMinor('1.2300','KWD'),1230);

assert.deepEqual(moneyFromMajor('125.50','eur'),{amountMinor:12550,currency:'EUR'});
assert.deepEqual(moneyFromMinor(12550,'EUR'),{amountMinor:12550,currency:'EUR'});
assert.equal(sameMoney({amountMinor:12550,currency:'eur'},moneyFromMajor('125.50','EUR')),true);

assert.equal(assertMinorAmount(0),0);
assert.equal(assertMinorAmount('900000'),900000);
assert.throws(()=>assertMinorAmount(10.5),e=>e.code==='INVALID_MINOR_UNITS');
assert.throws(()=>assertMinorAmount(-1),e=>e.code==='INVALID_MONEY_AMOUNT');
assert.throws(()=>assertMinorAmount(0,{allowZero:false}),e=>e.code==='INVALID_MONEY_AMOUNT');
assert.throws(()=>assertMinorAmount(Number.MAX_SAFE_INTEGER+1),e=>e.code==='INVALID_MINOR_UNITS');
assert.throws(()=>majorToMinor('1.001','EUR'),e=>e.code==='MONEY_SCALE_EXCEEDED');
assert.throws(()=>majorToMinor('-1','EUR'),e=>e.code==='INVALID_MAJOR_UNITS');
assert.throws(()=>majorToMinor('1e3','EUR'),e=>e.code==='INVALID_MAJOR_UNITS');
assert.throws(()=>normalizeCurrency('EURO'),e=>e.code==='INVALID_CURRENCY');

console.log('ANTIQUA 0.15 Money contract: currency exponents + exact major/minor conversion + unsafe amount rejection passed');
