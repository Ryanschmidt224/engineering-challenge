import {test} from "node:test";
import assert from "node:assert/strict";
import {lookupLabel,lookupValue} from "../assets/workshop-lookup-model.js";
test("lookup preserves exact units, types and engineering limits",()=>{
 const number={type:"number",unit:"V"};
 assert.equal(lookupValue(number,{value:"60",unit:"V"}),60);
 for(const value of ["<60","10–60","60 max","", "Infinity"])assert.equal(lookupValue(number,{value,unit:"V"}),undefined);
 assert.equal(lookupValue(number,{value:"60000",unit:"mV"}),undefined);
 assert.equal(lookupValue({...number,unit:"A"},{value:"60",unit:"V"}),undefined);
 assert.equal(lookupValue({type:"boolean",unit:""},{value:"false"}),false);
 assert.equal(lookupValue({type:"choice",unit:"",choices:["TO-92"]},{value:"to-92"}),"TO-92");
 assert.equal(lookupValue({type:"choice",unit:"",choices:["TO-92"]},{value:"SOT-23"}),undefined);
 assert.equal(lookupValue({type:"choice",unit:"",choices:[]},{value:"TO-92"}),"TO-92");
 assert.equal(lookupValue({type:"text",unit:""},{value:"5",unit:"Ω",conditions:"Vgs = 10 V"}),"5 Ω · Vgs = 10 V");
 assert.equal(lookupValue({type:"text",unit:""},{value:"60 max",conditions:"25°C"}),"60 max · 25°C");
 assert.equal(lookupLabel(" Power   rating "),"power rating");
});
