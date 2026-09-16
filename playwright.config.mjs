import {defineConfig,devices} from '@playwright/test';

const port=Number(process.env.BROWSER_E2E_PORT||12026);
export default defineConfig({
  testDir:'./tests/browser',
  timeout:45_000,
  expect:{timeout:8_000},
  fullyParallel:false,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  workers:1,
  reporter:process.env.CI?'line':'list',
  use:{
    baseURL:`http://127.0.0.1:${port}`,
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[
    {name:'chromium-desktop',use:{...devices['Desktop Chrome']}},
    {name:'chromium-mobile',use:{...devices['Pixel 7']}}
  ],
  webServer:{
    command:'node server-v14.mjs',
    url:`http://127.0.0.1:${port}/api/health`,
    reuseExistingServer:!process.env.CI,
    timeout:60_000,
    env:{...process.env,PORT:String(port),PREVIEW_MODE:'true',NODE_ENV:'test'}
  }
});
