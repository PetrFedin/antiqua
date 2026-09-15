import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT=Number(process.env.PORT||10000);
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PUBLIC=join(ROOT,'public');

const lots=[
 {id:'lot-101',lotNumber:101,department:'European Decorative Arts',maker:'French, Louis XVI period',title:'A gilt-bronze mounted mantel clock',period:'late 18th century',origin:'France',currency:'EUR',estimateLow:18000,estimateHigh:26000,image:'https://images.metmuseum.org/CRDImages/es/web-large/DP340468.jpg',cataloguing:'Gilt-bronze mounted case with enamel dial, architectural form. Demonstration catalogue record; measurements and marks would be mandatory before publication in a real sale.',provenance:['Demonstration provenance record','Private European collection — unverified in preview'],condition:'Demonstration condition report: surface wear and oxidation consistent with age; movement not tested. This text is illustrative and is not a report on the museum object pictured.',literature:['Reference imagery: The Metropolitan Museum of Art open collection.']},
 {id:'lot-102',lotNumber:102,department:'European Ceramics',maker:'Delft workshop',title:'A blue-and-white charger',period:'18th century',origin:'Netherlands',currency:'EUR',estimateLow:2800,estimateHigh:4200,image:'https://images.metmuseum.org/CRDImages/es/web-large/DP254624.jpg',cataloguing:'Tin-glazed earthenware painted in cobalt blue. Demonstration lot used to test structured object cataloguing.',provenance:['Demonstration record only'],condition:'Illustrative report: minor glaze wear and rim fritting should be mapped to detail photographs before a real listing.',literature:[]},
 {id:'lot-103',lotNumber:103,department:'Sculpture',maker:'European School',title:'Study of a horse',period:'late 19th century',origin:'Europe',currency:'EUR',estimateLow:6000,estimateHigh:9000,image:'https://images.metmuseum.org/CRDImages/es/web-large/DP169405.jpg',cataloguing:'Patinated bronze. Demonstration catalogue record for timed-auction interaction.',provenance:['Property of a demonstration collection'],condition:'Illustrative condition text only. Patina, casting seams, repairs and mounting would require specialist inspection.',literature:[]},
 {id:'lot-104',lotNumber:104,department:'European Paintings',maker:'European School',title:'River landscape at dusk',period:'19th century',origin:'Europe',currency:'EUR',estimateLow:9000,estimateHigh:14000,image:'https://images.metmuseum.org/CRDImages/ep/web-large/DP145903.jpg',cataloguing:'Oil on canvas. Demonstration object for visual hierarchy and condition/provenance presentation.',provenance:['Demonstration private collection'],condition:'Illustrative only: canvas support, craquelure and retouching would require examination and UV photography.',literature:[]},
 {id:'lot-105',lotNumber:105,department:'Works of Art',maker:'Italian',title:'A carved marble fragment',period:'18th–19th century',origin:'Italy',currency:'EUR',estimateLow:7500,estimateHigh:11000,image:'https://images.metmuseum.org/CRDImages/es/web-large/DP151938.jpg',cataloguing:'Carved marble architectural fragment. Demonstration listing.',provenance:['Demonstration provenance — not externally verified'],condition:'Illustrative only: chips, surface deposits and previous mounting points to be documented photographically.',literature:[]},
 {id:'lot-106',lotNumber:106,department:'European Furniture',maker:'French',title:'A neoclassical occasional table',period:'circa 1800',origin:'France',currency:'EUR',estimateLow:12000,estimateHigh:18000,image:'https://images.metmuseum.org/CRDImages/es/web-large/DP247929.jpg',cataloguing:'Demonstration furniture lot. Real publication would require woods, construction, mounts, dimensions and restoration history.',provenance:['Demonstration collection'],condition:'Illustrative only. Veneer movement, replacements, hardware and structural repairs should be listed independently.',literature:[]},
 {id:'lot-107',lotNumber:107,department:'Asian Works of Art',maker:'Chinese',title:'A monochrome glazed vessel',period:'Qing dynasty style',origin:'China',currency:'EUR',estimateLow:5000,estimateHigh:8000,image:'https://images.metmuseum.org/CRDImages/as/web-large/DP251139.jpg',cataloguing:'Demonstration Asian art record. The preview does not make an attribution or authenticity claim about the reference image.',provenance:['No publishable provenance in preview'],condition:'Illustrative only. Foot, glaze, firing flaws and restoration would require macro photography and specialist review.',literature:[]},
 {id:'lot-108',lotNumber:108,department:'Books & Manuscripts',maker:'Continental European',title:'An illuminated manuscript leaf',period:'15th century style',origin:'Europe',currency:'EUR',estimateLow:3500,estimateHigh:5500,image:'https://images.metmuseum.org/CRDImages/md/web-large/DP-16286-001.jpg',cataloguing:'Demonstration manuscript record for catalogue layout testing. No attribution is asserted.',provenance:['Demonstration record'],condition:'Illustrative only. Support, pigment, trimming, losses and later additions would require specialist examination.',literature:[]}
];

const auctions=lots.slice(0,6).map((lot,i)=>({id:`auc-${lot.lotNumber}`,lotId:lot.id,currency:lot.currency,currentBid:[14500,2600,5250,7200,6000,10000][i],increment:[500,200,250,500,500,500][i],bidCount:[9,4,7,3,5,2][i],endsAt:new Date(Date.now()+((i+5)*60*60*1000)).toISOString(),state:'LIVE'}));

const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(JSON.stringify(data));};
const readBody=async req=>{let raw='';for await(const c of req){raw+=c;if(raw.length>200000)throw new Error('Request too large')}return raw?JSON.parse(raw):{}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};

async function handleApi(req,res,url){
 if(url.pathname==='/api/health')return json(res,200,{status:'ok',service:'antiqua-preview',version:'0.5.0',persistence:'ephemeral',time:new Date().toISOString()});
 if(url.pathname==='/api/catalog')return json(res,200,{lots,auctions,disclaimer:'Preview catalogue data and selected museum reference imagery are demonstrative; no real consignment or authenticity claim is represented.'});
 const m=url.pathname.match(/^\/api\/auctions\/([^/]+)\/bid$/);
 if(m&&req.method==='POST'){
   const a=auctions.find(x=>x.id===m[1]); if(!a)return json(res,404,{error:'Auction not found'}); if(a.state!=='LIVE')return json(res,409,{error:'Auction is not open'});
   const body=await readBody(req); const amount=Number(body.amount); const minimum=a.currentBid+a.increment;
   if(!Number.isFinite(amount)||amount<minimum)return json(res,400,{error:`Minimum next bid is ${minimum}`});
   a.currentBid=Math.round(amount);a.bidCount+=1;
   if(Date.parse(a.endsAt)-Date.now()<120000)a.endsAt=new Date(Date.now()+120000).toISOString();
   return json(res,201,{auction:a,preview:true,message:'Bid accepted in preview only; no financial obligation created.'});
 }
 return json(res,404,{error:'Not found'});
}

async function serve(req,res,url){
 let p=url.pathname==='/'?'/index.html':url.pathname;
 if(p.includes('..'))return json(res,400,{error:'Invalid path'});
 try{const data=await readFile(join(PUBLIC,p));const type=mime[extname(p)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':p==='/index.html'?'no-store':'public, max-age=300','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});res.end(data);}catch{try{const data=await readFile(join(PUBLIC,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(data)}catch(e){json(res,500,{error:'Preview assets unavailable'})}}
}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(url.pathname.startsWith('/api/'))return await handleApi(req,res,url);return await serve(req,res,url);}catch(e){console.error(e);json(res,500,{error:'Unexpected server error'})}});
server.listen(PORT,'0.0.0.0',()=>console.log(`ANTIQUA 0.5 preview listening on ${PORT}`));
