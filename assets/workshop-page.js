import { initSiteHeader } from "./site-header.js?v=save-upload-20261128";
import { initSplitPanes } from "./split-panes.js?v=save-upload-20261128";
initSiteHeader();
initSplitPanes(document.querySelector(".workshop-layout"), {
  key: "workshop",
  panes: [
    {
      key: "categories",
      name: "categories",
      selector: ".category-panel",
      wideOnly: true,
    },
    { key: "families", name: "families", selector: ".family-panel" },
  ],
});
