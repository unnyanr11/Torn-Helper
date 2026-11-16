import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {runMinuteForecast,MODEL_TIMEOUT_MESSAGE,minuteForecastCacheKey} from '../lib/run-minute-forecast';
const points=[{timestamp:1794833400,price:100}];
const fake=()=>({postMessage:vi.fn(),terminate:vi.fn(),onmessage:null as any,onerror:null as any});
beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
it('stops an unresponsive model at 10 seconds and ignores late results',()=>{
 const worker=fake(),result=vi.fn(),error=vi.fn();
 runMinuteForecast(points,1794833410,1,{result,error},()=>worker as unknown as Worker);
 vi.advanceTimersByTime(9999);expect(error).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1);expect(error).toHaveBeenCalledExactlyOnceWith(MODEL_TIMEOUT_MESSAGE);expect(worker.terminate).toHaveBeenCalledTimes(1);
 worker.onmessage({data:{forecast:{}}});expect(result).not.toHaveBeenCalled();
});
it('shows an on-time result, measures runtime and clears its deadline',()=>{
 const worker=fake(),result=vi.fn(),error=vi.fn(),forecast={model:'Ridge'};
 runMinuteForecast(points,1794833410,5,{result,error},()=>worker as unknown as Worker);
 vi.advanceTimersByTime(50);worker.onmessage({data:{forecast}});
 expect(result).toHaveBeenCalledWith(forecast,expect.any(Number));expect(worker.terminate).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(10000);expect(error).not.toHaveBeenCalled();
});
it('cancels on navigation without delivering a stale result or timeout',()=>{
 const worker=fake(),result=vi.fn(),error=vi.fn();
 const cancel=runMinuteForecast(points,1794833410,1,{result,error},()=>worker as unknown as Worker);
 cancel();vi.advanceTimersByTime(10000);worker.onmessage({data:{forecast:{}}});
 expect(worker.terminate).toHaveBeenCalledTimes(1);expect(result).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
});
it('handles worker creation failures and distinguishes all cache inputs',()=>{
 const error=vi.fn();runMinuteForecast(points,1794833410,1,{result:vi.fn(),error},()=>{throw new Error('unsupported');});
 expect(error).toHaveBeenCalledOnce();vi.advanceTimersByTime(10000);expect(error).toHaveBeenCalledOnce();
 expect(minuteForecastCacheKey('2',1,points)).not.toBe(minuteForecastCacheKey('3',1,points));
 expect(minuteForecastCacheKey('2',1,points)).not.toBe(minuteForecastCacheKey('2',5,points));
 expect(minuteForecastCacheKey('2',1,points)).not.toBe(minuteForecastCacheKey('2',1,[{...points[0],price:101}]));
});
