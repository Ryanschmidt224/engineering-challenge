import { initSiteHeader } from "./site-header.js?v=offsite-backup-20261128";
import { initProjectSignin } from "./project-signin.js?v=offsite-backup-20261128";
initSiteHeader();
const open = initProjectSignin({
  onSignIn: () => location.reload(),
  onSignOut: () => location.reload(),
});
document.querySelector("[data-signin]").onclick = () => open();
