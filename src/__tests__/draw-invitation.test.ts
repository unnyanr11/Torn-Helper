import {it,expect} from 'vitest';
import {drawInvitation,drawInvitationLink} from '../lib/draw-invitation';
const id='00000000-0000-4000-8000-000000000001';
it('generates clean signup-capable links without copying session parameters',()=>{
 expect(drawInvitationLink('https://torncity-helper.vercel.app/?code=private#access_token=secret',id)).toBe(`https://torncity-helper.vercel.app/?draw=${id}`);
 expect(drawInvitation(`https://torncity-helper.vercel.app/?draw=${id}`)).toBe(id);
 expect(drawInvitation(`https://torncity-helper.vercel.app/#Lucky%20Draws?campaign=${id}`)).toBe(id);
});
it('does not hijack normal navigation or accept arbitrary redirects',()=>{
 expect(drawInvitation(`https://torncity-helper.vercel.app/?draw=${id}#Settings`)).toBeNull();
 expect(drawInvitation('https://torncity-helper.vercel.app/?draw=https://evil.example')).toBeNull();
 expect(drawInvitation('https://torncity-helper.vercel.app/#%notvalid')).toBeNull();
 expect(()=>drawInvitationLink('javascript:alert(1)',id)).toThrow();
});
