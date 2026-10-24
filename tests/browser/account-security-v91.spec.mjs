import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import {mkdir} from 'node:fs/promises';

const unique=()=>crypto.randomUUID().replaceAll('-','');
const credentials=()=>({
 email:'security-v91-'+unique()+'@example.test',
 displayName:'Collector security acceptance',
 password:'Aa9!'+unique()
});
const account=page=>page.locator('.account-v12');
const header=page=>page.locator('#sessionAction');
async function loggedOut(page){
 const session=await page.evaluate(async()=>{
  const [me,privateRead]=await Promise.all([
   fetch('/api/auth/me').then(r=>r.json()),
   fetch('/api/conversations').then(r=>r.status)
  ]);
  return {account:me.account,privateRead};
 });
 expect(session.account).toBeNull();
 expect(session.privateRead).toBe(401);
}
async function signIn(page,creds){
 const form=page.locator('form#login');
 await expect(form).toBeVisible();
 await form.locator('[name="email"]').fill(creds.email);
 await form.locator('[name="password"]').fill(creds.password);
 await form.locator('button').click();
 return form;
}

test('v91 complete account lifecycle: sign in/out, 2FA code, recovery-once, identity revocation',async({page})=>{
 const creds=credentials();
 // Explicit anonymous entry: other preview flows may have seeded browser cookies.
 await page.context().clearCookies();
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await expect(header(page)).toBeVisible();
 await expect(header(page)).toContainText(/Войти|Sign in/);
 await loggedOut(page);
 const register=page.locator('#register');
 await expect(register).toBeVisible();
 await register.locator('[name="displayName"]').fill(creds.displayName);
 await register.locator('[name="email"]').fill(creds.email);
 await register.locator('[name="password"]').fill(creds.password);
 await register.locator('[name="accountType"]').selectOption('BUYER');
 await register.locator('button').click();
 await expect(account(page)).toBeVisible();
 await expect(account(page)).toContainText(creds.displayName);
 await expect(header(page)).toContainText(/Выйти|Sign out/);
 await expect(account(page).locator('[data-account-logout]')).toBeVisible();
 await expect(account(page).locator('[data-setup-2fa]')).toBeVisible();

 await account(page).locator('[data-setup-2fa]').click();
 const sheet=page.locator('#actionSheet[open]');
 await expect(sheet).toBeVisible();
 await expect(sheet.locator('#confirm2fa')).toBeVisible();
 // The disposable preview fixture exposes only the current demo TOTP.
 await expect(sheet.locator('#twoFactorCode')).not.toHaveValue('');
 await sheet.locator('#confirm2fa').click();
 await expect(sheet.locator('#twoFactorBackupCodes')).toBeVisible();
 const displayed=(await sheet.locator('#twoFactorBackupCodes').textContent()||'').trim();
 const codes=displayed.split(/\s+/).filter(Boolean);
 expect(codes.length).toBeGreaterThanOrEqual(5);
 expect(new Set(codes).size).toBe(codes.length);
 await expect(account(page)).not.toHaveAttribute('aria-busy','true');
 const secondSetup=await page.evaluate(async()=>{
  const me=await (await fetch('/api/auth/me')).json();
  const r=await fetch('/api/auth/2fa/setup',{method:'POST',
   headers:{'x-csrf-token':me.csrf,'content-type':'application/json'},body:'{}'});
  return {status:r.status,data:await r.json()};
 });
 expect(secondSetup.status).toBe(409);
 expect(secondSetup.data.code).toBe('TWO_FACTOR_ALREADY_ENABLED');
 expect(secondSetup.data.secret).toBeUndefined();
 await sheet.locator('#ackBackupCodes').click();
 await expect(page.locator('#actionSheet[open]')).toHaveCount(0);
 await expect(page.locator('[data-recovery-codes]')).toHaveCount(0);
 await account(page).locator('[data-account-logout]').click();
 await expect(page.locator('#login')).toBeVisible();
 await expect(header(page)).toContainText(/Войти|Sign in/);
 await loggedOut(page);
 const login=await signIn(page,creds);
 const otp=login.locator('[data-auth-totp]');
 await expect(otp).toBeVisible();
 const field=otp.locator('input[name="totp"]');
 await expect(field).toBeFocused();
 await mkdir('artifacts/visual-proof',{recursive:true});
 await page.screenshot({path:'artifacts/visual-proof/v91-'+test.info().project.name+'-second-factor-PREVIEW.png'});
 await field.fill(codes[0]);
 await login.locator('button').click();
 await expect(account(page)).toBeVisible();
 await expect(header(page)).toContainText(/Выйти|Sign out/);
 await expect(page.locator('[data-recovery-codes]')).toHaveCount(0);
 await header(page).click();
 await expect(page.locator('#login')).toBeVisible();
 await loggedOut(page);

 const secondLogin=await signIn(page,creds);
 const secondCode=secondLogin.locator('input[name="totp"]');
 await expect(secondCode).toBeVisible();
 await secondCode.fill(codes[0]);
 await secondLogin.locator('button').click();
 await expect(page.locator('#login')).toBeVisible();
 await loggedOut(page);
 await expect(secondCode).toHaveValue('');
});

test('v91 actual session switch keeps buyer, seller and operator separated and visible login/out on phone',async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.context().clearCookies();
 await page.goto('/#account',{waitUntil:'domcontentloaded'});
 await expect(header(page)).toBeVisible();
 await expect(page.locator('#persona')).toBeHidden();
 const width=await header(page).evaluate(e=>({
  right:e.getBoundingClientRect().right,
  visible:e.getBoundingClientRect().width>20,
  viewport:document.documentElement.clientWidth
 }));
 expect(width.visible).toBe(true);
 expect(width.right).toBeLessThanOrEqual(width.viewport+2);
 for(const persona of ['BUYER','SELLER','OPERATOR']){
  const login=await page.evaluate(async persona=>{
   const r=await fetch('/api/auth/demo-login',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({persona})
   });
   return {status:r.status,data:await r.json()};
  },persona);
  expect(login.status).toBe(200);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(account(page)).toBeVisible();
  await expect(header(page)).toContainText(/Выйти|Sign out/);
  const roles=login.data.account.roles;
  if(persona==='BUYER')expect(roles).toContain('BUYER');
  if(persona==='SELLER')expect(roles).toContain('SELLER');
  if(persona==='OPERATOR')expect(roles).toContain('ADMIN');
  if(persona==='SELLER'){
   await mkdir('artifacts/visual-proof',{recursive:true});
   await page.screenshot({path:'artifacts/visual-proof/v91-mobile-collector-to-dealer-PREVIEW.png'});
  }
  const cockpitStatus=await page.evaluate(async()=>{
   const r=await fetch('/api/operator/cockpit');return r.status;
  });
  expect(cockpitStatus).toBe(persona==='OPERATOR'?200:403);
  await header(page).click();
  await expect(page.locator('#login')).toBeVisible();
  await loggedOut(page);
 }
});
