import {S3Client,CreateBucketCommand,HeadBucketCommand} from '@aws-sdk/client-s3';

const required=['OBJECT_STORAGE_ENDPOINT','OBJECT_STORAGE_REGION','OBJECT_STORAGE_ACCESS_ID','OBJECT_STORAGE_ACCESS_SECRET','OBJECT_STORAGE_BUCKET'];
for(const key of required)if(!process.env[key])throw new Error(`${key} is required`);
const s3=new S3Client({endpoint:process.env.OBJECT_STORAGE_ENDPOINT,region:process.env.OBJECT_STORAGE_REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.OBJECT_STORAGE_ACCESS_ID,secretAccessKey:process.env.OBJECT_STORAGE_ACCESS_SECRET}}),Bucket=process.env.OBJECT_STORAGE_BUCKET;
try{await s3.send(new HeadBucketCommand({Bucket}))}catch{try{await s3.send(new CreateBucketCommand({Bucket}))}catch(e){if(!['BucketAlreadyExists','BucketAlreadyOwnedByYou'].includes(e?.name))throw e}}
await s3.send(new HeadBucketCommand({Bucket}));
console.log(`ANTIQUA object storage ready: ${Bucket}`);
