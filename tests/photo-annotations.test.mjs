import test from "node:test";
import assert from "node:assert/strict";
import {resolvePhotoSource,annotationKey,renditionKey} from "../functions/api/photo-annotations.js";

test("photo edit keys remain separate from immutable originals",()=>{
 const id="launcher/12345678-1234-1234-1234-123456789abc.png";
 const target=resolvePhotoSource(new URL("https://example.test/api/photo-annotations?kind=gallery&id="+encodeURIComponent(id)));
 assert.deepEqual(target,{key:id,project:"launcher"});
 assert.equal(annotationKey(id),"photo-annotations/"+id+".json");
 assert.equal(renditionKey(id),"photo-renders/"+id+".webp");
 assert.notEqual(annotationKey(id),id);
 assert.notEqual(renditionKey(id),id);
});
test("part and work instruction image keys are scoped to projects",()=>{
 const part=resolvePhotoSource(new URL("https://example.test/api/photo-annotations?kind=part&project=robot&id=12345678-1234-1234-1234-123456789abc"));
 assert.deepEqual(part,{key:"component-thumbnails/robot/12345678-1234-1234-1234-123456789abc",project:"robot"});
 const recipe=resolvePhotoSource(new URL("https://example.test/api/photo-annotations?kind=recipe&id=recipe-files%2Frobot%2F12345678-1234-1234-1234-123456789abc.png"));
 assert.equal(recipe.project,"robot");
});
test("disallow unknown keys and unsupported non-image attachments",()=>{
 for(const raw of [
  "https://example.test/api/photo-annotations?kind=gallery&id=launcher%2F..%2Fsecret",
  "https://example.test/api/photo-annotations?kind=recipe&id=recipe-files%2Frobot%2F12345678-1234-1234-1234-123456789abc.pdf",
  "https://example.test/api/photo-annotations?kind=part&project=unknown&id=12345678-1234-1234-1234-123456789abc"
 ])assert.equal(resolvePhotoSource(new URL(raw)),null);
});
