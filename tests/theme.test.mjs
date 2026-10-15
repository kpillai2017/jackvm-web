import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../theme.css',import.meta.url),'utf8');
const tokens=Object.fromEntries([...css.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/g)].map(m=>[m[1],m[2]]));
// WCAG relative luminance, including the sRGB transfer function. This checks
// opaque semantic pairs; browser tests verify those tokens are actually used.
function luminance(hex) {
 const linear=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}
function contrast(a,b) {const x=luminance(tokens[a]),y=luminance(tokens[b]);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('semantic body, muted, link and status text pairs meet WCAG AA contrast',()=>{
 const pairs=[['text','surface'],['text','bg'],['text-secondary','surface'],['text-secondary','surface-inset'],
  ['text-muted','surface'],['text-muted','bg'],['accent','surface'],['accent','surface-inset'],
  ['on-primary','primary'],['on-primary','primary-hover'],['text','surface-hover'],['text','border'],
  ['success-text','success'],['success-text','success-hover'],['success-text','surface'],
  ['warning-text','warning'],['warning-text','warning-hover'],['danger','surface'],['disabled-text','disabled-bg']];
 for(const[a,b]of pairs) assert.ok(contrast(a,b)>=4.5,`${a}/${b}: ${contrast(a,b).toFixed(2)}:1`);
});
test('active input boundaries and focus ring meet 3:1 non-text contrast',()=>{
 for(const bg of ['surface','surface-inset','bg']) {
  assert.ok(contrast('control-border',bg)>=3,`input boundary on ${bg}`);
  assert.ok(contrast('focus',bg)>=3,`focus ring on ${bg}`);
 }
});
