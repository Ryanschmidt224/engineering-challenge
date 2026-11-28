import { initSiteHeader } from "./site-header.js?v=css-foundation-20261122";
import { initSplitPanes } from "./split-panes.js?v=split-panes-20261122";
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
