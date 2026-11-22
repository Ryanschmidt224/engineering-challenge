import {test} from "node:test";
import assert from "node:assert/strict";
import {fitPaneWidths} from "../assets/split-panes.js";
test("split panes keep a detail budget while preserving minimums and valid preferred widths",()=>{
 assert.deepEqual(fitPaneWidths([272,304],[192,192],512,700),[272,304]);
 assert.deepEqual(fitPaneWidths([900,20],[192,192],512,800),[512,192]);
 const fitted=fitPaneWidths([400,400],[192,192],512,600);
 assert.deepEqual(fitted,[300,300]);assert.equal(fitted.reduce((a,b)=>a+b),600);
 assert.deepEqual(fitPaneWidths([400,300],[192,192],512,384),[192,192]);
 assert.deepEqual(fitPaneWidths([400],[192],512,250),[250]);
});
