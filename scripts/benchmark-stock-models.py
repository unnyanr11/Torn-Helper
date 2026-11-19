import os
os.environ['OMP_NUM_THREADS']='1'
os.environ['OPENBLAS_NUM_THREADS']='1'
import json,time,sys,numpy as np
from lightgbm import LGBMRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
rows=[json.loads(line) for line in open(sys.argv[1])]
output=[]
for row in rows:
 raw=row['history']['points']; raw={int(t):float(p) for t,p in raw}; times=np.arange(min(raw),max(raw)+1,60); real=np.array([t in raw for t in times]); prices=np.array([raw.get(t,np.nan) for t in times]); missing=np.flatnonzero(~real)
 for i in missing:
  left=i-1
  while left>=0 and not real[left]:left-=1
  right=i+1
  while right<len(times) and not real[right]:right+=1
  if left>=0 and right<len(times):prices[i]=(prices[left]+prices[right])/2
 def features(i):
  p=prices[i-60:i+1];r=p[1:]/p[:-1]-1
  return [r[-1],r[-2],*[np.mean(r[-n:]) for n in [3,5,15,60]],*[np.std(r[-n:]) for n in [5,15,60]],*[prices[i]/np.mean(p[-n:])-1 for n in [5,20,60]]]
 X=np.array([features(i) for i in range(60,len(times))]); base=times[60:]; end=times[-1];cut1=end-2*86400;cut2=end-86400
 for h in [1,5,15,60]:
  origins=np.arange(60,len(times)-h); target=times[origins+h]; y=prices[origins+h]/prices[origins]-1;x=X[origins-60]
  valid=real[origins]&real[origins+h]&np.isfinite(x).all(axis=1);train=valid&(target<cut1);tune=valid&(times[origins]>=cut1)&(target<cut2);test=valid&(times[origins]>=cut2)
  for name in ['No change','Momentum','Mean reversion','Ridge','LightGBM']:
   def fit(mask):
    if name=='Ridge':return make_pipeline(StandardScaler(),Ridge(alpha=1)).fit(x[mask],y[mask])
    if name=='LightGBM':return LGBMRegressor(n_estimators=64,num_leaves=15,max_depth=5,min_child_samples=80,learning_rate=.05,n_jobs=1,verbosity=-1,random_state=42).fit(x[mask],y[mask])
   def predict(model,mask):
    if name=='No change':return np.zeros(mask.sum())
    if name=='Momentum':return x[mask,3]
    if name=='Mean reversion':return -x[mask,10]/20
    return model.predict(x[mask])
   start=time.perf_counter();model=fit(train);v=predict(model,tune);vt=time.perf_counter()-start
   start=time.perf_counter();model=fit(valid&(target<cut2));trainms=(time.perf_counter()-start)*1000
   start=time.perf_counter();pred=predict(model,test);predictms=(time.perf_counter()-start)*1000
   actual=y[test];nonflat=np.abs(actual)>1e-10
   output.append(dict(stock_id=row['stock_id'],horizon=h,model=name,validation_mae=float(np.mean(np.abs(v-y[tune]))),test_mae=float(np.mean(np.abs(pred-actual))),test_count=int(len(actual)),direction_correct=int(((np.sign(pred)==np.sign(actual))&nonflat).sum()),nonflat_count=int(nonflat.sum()),train_ms=trainms,test_prediction_ms=predictms))
 print('benchmarked',row['stock_id'],flush=True)
json.dump({'dataset_end':int(end),'stocks':len(rows),'rows':output},open(sys.argv[2],'w'))
for name in ['No change','Momentum','Mean reversion','Ridge','LightGBM']:
 selected=[r for r in output if r['model']==name];print(name,'MAE',np.mean([r['test_mae'] for r in selected]),'direction',sum(r['direction_correct'] for r in selected)/sum(r['nonflat_count'] for r in selected),'train_s',sum(r['train_ms'] for r in selected)/1000,'prediction_s',sum(r['test_prediction_ms'] for r in selected)/1000)
