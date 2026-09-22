import {send,readBody,requireCsrf,audit} from './runtime-v09.mjs';
import {createObjectInquiry,inquiryCapabilities} from './inquiry-v21.mjs';

export async function routeInquiryV21(req,res,url,ctx){
 if(url.pathname==='/api/inquiries/capabilities'&&req.method==='GET')return send(res,200,{capabilities:inquiryCapabilities()});
 if(url.pathname!=='/api/inquiries'||req.method!=='POST')return false;
 if(!ctx)return send(res,401,{error:'Authentication required',code:'AUTH_REQUIRED'});
 requireCsrf(req,ctx);
 const result=await createObjectInquiry(ctx.account,await readBody(req));
 await audit(req,ctx.account,result.idempotent?'OBJECT_INQUIRY_REPLAY':'OBJECT_INQUIRY_SENT','CONVERSATION',result.conversation.id,null,null,{listingId:result.conversation.listingId,objectId:result.conversation.objectId,inquiryType:result.inquiryType,messageId:result.message.id});
 return send(res,result.idempotent?200:201,result);
}
