import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import AccountRegistration from '../components/AccountRegistration';
const mocks=vi.hoisted(()=>({invoke:vi.fn(),login:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{functions:{invoke:mocks.invoke},auth:{signInWithPassword:mocks.login}}}));
let root:ReactTestRenderer|undefined;
afterEach(()=>{act(()=>root?.unmount());root=undefined;});
beforeEach(()=>{mocks.invoke.mockReset().mockResolvedValue({data:{registered:true},error:null});mocks.login.mockReset().mockResolvedValue({error:null});});
async function submit(onSignedIn=vi.fn(async()=>{})){
 act(()=>{root=create(<AccountRegistration onSignedIn={onSignedIn}/>);});
 const inputs=root!.root.findAllByType('input');
 const set=(input:any,value:string)=>act(()=>input.props.onChange({target:{value}}));
 set(inputs.find(i=>i.props.autoComplete==='username'),'NewPlayer');
 set(inputs.find(i=>i.props.inputMode==='numeric'),'123');
 set(inputs.find(i=>i.props.maxLength===16&&i.props.type==='password'),'AbCdEf0123456789');
 for(const input of inputs.filter(i=>i.props.type==='email'))set(input,'player@example.com');
 for(const input of inputs.filter(i=>i.props.autoComplete==='new-password'))set(input,'strong password 123');
 act(()=>inputs.find(i=>i.props.type==='checkbox')!.props.onChange({target:{checked:true}}));
 await act(async()=>{root!.root.findByType('form').props.onSubmit({preventDefault:vi.fn()});await new Promise(r=>setTimeout(r,0));});
 return onSignedIn;
}
it('signs in immediately after verified registration without a confirmation step',async()=>{
 const signedIn=await submit();
 expect(mocks.invoke).toHaveBeenCalledWith('register-torn',expect.objectContaining({body:expect.objectContaining({username:'NewPlayer',tornId:'123'})}));
 expect(mocks.login).toHaveBeenCalledWith({email:'player@example.com',password:'strong password 123'});
 expect(signedIn).toHaveBeenCalledOnce();expect(JSON.stringify(root!.toJSON())).not.toContain('Resend confirmation');
 expect(root!.root.findAllByType('input').filter(i=>i.props.type==='password').every(i=>i.props.value==='')).toBe(true);
});
it('keeps a created account usable if automatic sign-in fails',async()=>{
 mocks.login.mockResolvedValueOnce({error:new Error('temporary auth failure')});
 const signedIn=await submit();expect(signedIn).not.toHaveBeenCalled();
 expect(JSON.stringify(root!.toJSON())).toContain('Account created. Automatic sign-in failed');
 expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
