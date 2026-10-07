import assert from 'node:assert/strict';
import {isPaintingCategory,assertPaintingCategory,paintingsDomainCapabilities} from '../art-domain-v50.mjs';

for(const value of ['Painting','Watercolor','Gouache','Tempera','Pastel','Acrylic Painting','Живопись','Акварель','Гуашь','Темпера','Пастель']){
 assert.equal(isPaintingCategory(value),true,value+' must be in paintings-only scope');
}
for(const value of ['Drawing','Etching','Engraving','Lithograph','Printmaking','Works on Paper','Sculpture','Decorative Arts','Clocks','Furniture','Рисунок','Офорт','Гравюра','Скульптура','Часы','Мебель']){
 assert.equal(isPaintingCategory(value),false,value+' must stay outside paintings-only scope');
}
assert.throws(()=>assertPaintingCategory('Sculpture'),e=>e?.code==='PAINTING_CATEGORY_REQUIRED');
const caps=paintingsDomainCapabilities();
assert.equal(caps.publicScope,'PAINTINGS_ONLY');
assert.equal(caps.drawing,false);
assert.equal(caps.printmaking,false);
assert.equal(caps.sculpture,false);
assert.equal(caps.furniture,false);
console.log('ANTIQUA v50 paintings-only domain contract passed');
