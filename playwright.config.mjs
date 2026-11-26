import {defineConfig} from "@playwright/test";
export default defineConfig({
 // Real Worker workflows share a resettable D1/R2 fixture. Concurrent resets
 // invalidate another test's owner session and records; serialize these tests.
 workers:1,
 testDir:"./tests",
 testMatch:"browser-*.spec.mjs",
 use:{baseURL:"http://127.0.0.1:4173",browserName:"chromium",headless:true},
 webServer:{
  command:"node scripts/test-server.mjs",
  url:"http://127.0.0.1:4173/__test__/ready",
  reuseExistingServer:!process.env.CI,
  timeout:30000
 }
});
