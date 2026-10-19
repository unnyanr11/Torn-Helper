import {describe,it,expect} from 'vitest';
import {publicApiPath} from '../../supabase/functions/_shared/routes';
describe('public API gateway routing',()=>{
 it.each(['/functions/v1/public-api','/public-api','/'])('handles the root path %s',path=>{expect(publicApiPath(path)).toBe('/');});
 it.each(['/functions/v1/public-api/capabilities','/public-api/capabilities','/capabilities'])('handles endpoint path %s',path=>{expect(publicApiPath(path)).toBe('/capabilities');});
 it('does not strip unrelated prefixes',()=>{expect(publicApiPath('/public-api-other/capabilities')).toBe('/public-api-other/capabilities');});
});
