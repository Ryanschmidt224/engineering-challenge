import { initSiteHeader } from "./site-header.js";
import { initProjectSignin } from "./project-signin.js";
initSiteHeader();
const open = initProjectSignin({
  onSignIn: () => location.reload(),
  onSignOut: () => location.reload(),
});
document.querySelector("[data-signin]").onclick = () => open();
