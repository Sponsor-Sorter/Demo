const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const html=readFileSync(path.join(__dirname,'../signup.html'),'utf8');
const sponsorStart=html.indexOf('id="sponsor-options"');
const creatorStart=html.indexOf('id="besponsored-options"');
const panels={sponsor:html.slice(sponsorStart,creatorStart),creator:html.slice(creatorStart)};
const mappings={
  sponsor:{'Target Audience:':'target-audience','Preferred Age Range:':'age-range','Preferred Content Format:':'preferred-content-format','Preferred Partnership Type:':'partnership-type','Preferred Location:':'preferred-location'},
  creator:{'Target Audience:':'target-audience-sponsee','Preferred Age Range:':'age-range-sponsee','Preferred Content Format:':'preferred-content-format-sponsee','Preferred Partnership Type:':'partnership-type-sponsee','Preferred Location:':'location-sponsee'}
};
for(const [role,expected] of Object.entries(mappings))test(`${role} preference labels target their own role controls`,()=>{
  assert.ok(sponsorStart>=0&&creatorStart>sponsorStart);
  const labels=[...panels[role].matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)];
  for(const [text,id] of Object.entries(expected)){
    const matching=labels.filter(([,attrs,body])=>body.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()===text);
    assert.equal(matching.length,1,`${role}: ${text}`);
    assert.equal(matching[0][1].match(/\bfor="([^"]+)"/)?.[1],id,`${role}: ${text}`);
    assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`,'g'))].length,1,`${id} unique`);
    assert.match(panels[role],new RegExp(`<select\\b[^>]*\\bid="${id}"`));
  }
});

test('personal location keeps its own label and input association',()=>{
  const personal=html.slice(0,sponsorStart);
  assert.match(personal,/<label for="location">Location:<\/label>/);
  assert.match(personal,/<input\b[^>]*\bid="location"/);
});
