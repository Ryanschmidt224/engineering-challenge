import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:"./tests",
 testMatch:["browser-startup.spec.mjs","workshop-templates.spec.mjs"],
 use:{baseURL:"http://127.0.0.1:4173",browserName:"chromium",headless:true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}}:{})},
 webServer:{
  command:"python3 -m http.server 4173 --bind 127.0.0.1",
  url:"http://127.0.0.1:4173/",
  reuseExistingServer:!process.env.CI,
  timeout:30000
 }
});
