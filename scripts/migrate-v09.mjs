import {createPersistence} from '../persistence-v09.mjs';
const p=await createPersistence({requireDatabase:true});
await p.migrate();
console.log('ANTIQUA migrations applied');
await p.close();
