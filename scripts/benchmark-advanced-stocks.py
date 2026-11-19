"""Matched, chronological CPU benchmark. Never modifies production models.
Input: observed shared-market JSONL as documented in docs/STOCK_MODELS.md.
"""
import os
THREADS=int(os.environ.get("TORN_BENCH_THREADS","2"))
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:
 os.environ[key]=str(THREADS)
os.environ['HF_HUB_DISABLE_XET']='1'
os.environ['HF_HUB_DOWNLOAD_TIMEOUT']='60'
import argparse,json,time,platform,gc,math,hashlib,sys
from pathlib import Path
import numpy as np
HORIZONS=[1,5,15,60]
def prepare(path):
 fingerprint=hashlib.sha256(Path(path).read_bytes()).hexdigest();cache=Path(path+'.advanced-v1.npz')
 if cache.exists():
  with np.load(cache,allow_pickle=False) as c:
   if str(c['fingerprint'])==fingerprint:return {k:(c[k].tolist() if k in ['ids','origins'] else c[k].item() if k=='test_start' else c[k]) for k in ['ids','stamps','real','prices','features','origins','test_start']}
 rows=[json.loads(s) for s in Path(path).read_text().splitlines() if s.strip()]
 assert sorted(r['stock_id'] for r in rows)==list(range(1,36)), 'Expected all 35 distinct stock IDs'
 end=min(max(int(t) for t,p in row['history']['points']) for row in rows)
 start=max(min(int(t) for t,p in row['history']['points']) for row in rows)
 stamps=np.arange(start,end+1,60,dtype=np.int64)
 real=[];prices=[];ids=[]
 for row in rows:
  raw={int(t):float(p) for t,p in row['history']['points'] if start<=int(t)<=end}
  mask=np.array([int(t) in raw for t in stamps]);p=np.array([raw.get(int(t),np.nan) for t in stamps])
  indices=np.flatnonzero(mask)
  for left,right in zip(indices[:-1],indices[1:]):
   if right-left>1:p[left+1:right]=(p[left]+p[right])/2
  assert mask[0] and mask[-1] and np.isfinite(p).all(),'Need common observed endpoints'
  ids.append(row['stock_id']);real.append(mask);prices.append(p)
 prices=np.array(prices);real=np.array(real)
 test_start=end-86400;origin_indices=[]
 for slot in range(12):
  wanted=test_start+slot*7200
  for delta in range(10):
   stamp=wanted+delta*60;i=int((stamp-start)//60)
   if i>=60 and i+60<len(stamps) and real[:,[i,*[i+h for h in HORIZONS]]].all():origin_indices.append(i);break
 assert len(origin_indices)>=8,'Insufficient matched origins'
 features=[]
 for p in prices:
  returns=p[1:]/p[:-1]-1
  x=np.zeros((len(p),12),dtype=np.float64)
  for i in range(60,len(p)):
   r=returns[i-60:i];window=p[i-60:i+1]
   x[i]=[r[-1],r[-2],*[r[-n:].mean() for n in [3,5,15,60]],*[r[-n:].std() for n in [5,15,60]],*[p[i]/window[-n:].mean()-1 for n in [5,20,60]]]
  features.append(x)
 result=dict(ids=ids,stamps=stamps,real=real,prices=prices,features=np.array(features),origins=origin_indices,test_start=test_start)
 temporary=Path(str(cache)+f'.{os.getpid()}.tmp.npz')
 np.savez_compressed(temporary,fingerprint=fingerprint,**result)
 temporary.replace(cache)
 return result
def metrics(data,pred):
 actual=np.stack([data['prices'][:,np.array(data['origins'])+h] for h in HORIZONS],axis=-1)
 assert pred.shape==actual.shape and np.isfinite(pred).all(), 'Invalid forecast outputs'
 origin=data['prices'][:,data['origins'],None]
 returns=actual/origin-1;estimate=pred/origin-1
 by=[]
 for j,h in enumerate(HORIZONS):
  a=returns[:,:,j];e=estimate[:,:,j];mask=np.abs(a)>1e-10
  by.append(dict(horizon=h,forecasts=int(a.size),nonflat=int(mask.sum()),direction_accuracy=float((np.sign(e[mask])==np.sign(a[mask])).mean()) if mask.any() else None,relative_mae=float(np.abs(e-a).mean())))
 mask=np.abs(returns)>1e-10
 return dict(direction_accuracy=float((np.sign(estimate[mask])==np.sign(returns[mask])).mean()),relative_mae=float(np.abs(estimate-returns).mean()),forecasts=int(returns.size),nonflat=int(mask.sum()),by_horizon=by)
def factory(name):
 if name=='Ridge':
  from sklearn.pipeline import make_pipeline
  from sklearn.preprocessing import StandardScaler
  from sklearn.linear_model import Ridge
  return make_pipeline(StandardScaler(),Ridge(alpha=1))
 if name=='LightGBM-256':
  from lightgbm import LGBMRegressor
  return LGBMRegressor(n_estimators=256,num_leaves=15,max_depth=5,min_child_samples=80,learning_rate=.03,n_jobs=THREADS,verbosity=-1,random_state=42)
 if name=='XGBoost-256':
  from xgboost import XGBRegressor
  return XGBRegressor(n_estimators=256,max_depth=4,learning_rate=.03,min_child_weight=80,reg_lambda=10,subsample=.8,colsample_bytree=.8,n_jobs=THREADS,tree_method='hist',random_state=42)
 if name=='CatBoost-256':
  from catboost import CatBoostRegressor
  return CatBoostRegressor(iterations=256,depth=6,learning_rate=.03,l2_leaf_reg=10,thread_count=THREADS,verbose=False,random_seed=42,allow_writing_files=False)
 if name in ['ExtraTrees-96','RandomForest-96']:
  from sklearn.ensemble import ExtraTreesRegressor,RandomForestRegressor
  cls=ExtraTreesRegressor if name.startswith('Extra') else RandomForestRegressor
  return cls(n_estimators=96,max_depth=8,min_samples_leaf=40,max_features=.8,n_jobs=THREADS,random_state=42)
 raise ValueError(name)
def classical(data,name):
 models=[];pred=np.empty((35,len(data['origins']),4));start=time.perf_counter()
 for s in range(35):
  for j,h in enumerate(HORIZONS):
   ix=np.arange(60,len(data['stamps'])-h)
   train=(data['stamps'][ix+h]<data['test_start'])&data['real'][s,ix]&data['real'][s,ix+h]
   model=factory(name);model.fit(data['features'][s,ix[train]],data['prices'][s,ix[train]+h]/data['prices'][s,ix[train]]-1)
   models.append((s,j,model))
  print('fitted',name,s+1,flush=True)
 fitting=time.perf_counter()-start
 for s,j,model in models:
  pred[s,:,j]=data['prices'][s,data['origins']]*(1+model.predict(data['features'][s,data['origins']]))
 runs=[]
 for _ in range(5):
  start=time.perf_counter()
  for s,j,model in models:model.predict(data['features'][s,-1:])
  runs.append(time.perf_counter()-start)
 return dict(model=name,status='complete',fitting_s=fitting,cold_load_s=None,warm_batch_s=runs,warm_median_s=float(np.median(runs)),warm_p95_s=float(np.percentile(runs,95)),**metrics(data,pred))
def neural(data,name,output_path):
 import torch
 torch.set_num_threads(THREADS);torch.set_num_interop_threads(2)
 start=time.perf_counter();bf16=name.endswith('bf16')
 if name.startswith('Chronos'):
  from chronos import BaseChronosPipeline,Chronos2Pipeline
  repo='amazon/chronos-2' if name.startswith('Chronos-2') else 'amazon/chronos-bolt-small'
  cls=Chronos2Pipeline if name.startswith('Chronos-2') else BaseChronosPipeline
  pipe=cls.from_pretrained(repo,device_map='cpu',torch_dtype=torch.bfloat16 if bf16 else torch.float32)
  context=8192 if name.startswith('Chronos-2') else 2048
  def forecast(i):
   batch=torch.tensor(data['prices'][:,max(0,i+1-context):i+1],dtype=torch.float32)
   with torch.inference_mode(),torch.autocast(device_type='cpu',dtype=torch.bfloat16,enabled=bf16):
    if name.startswith('Chronos-2'):
     q,mean=pipe.predict_quantiles(batch.unsqueeze(0 if 'joint' in name else 1),prediction_length=60,quantile_levels=[.1,.5,.9])
     if isinstance(mean,list):mean=torch.cat(mean,dim=0)
     return mean.detach().float().cpu().numpy().reshape(35,60)
    q,mean=pipe.predict_quantiles(batch,prediction_length=60,quantile_levels=[.1,.5,.9])
    return mean.detach().float().cpu().numpy().reshape(35,60)
 else:
  import timesfm
  context=10240
  pipe=timesfm.TimesFM_2p5_200M_torch.from_pretrained('google/timesfm-2.5-200m-pytorch',torch_compile=False)
  pipe.compile(timesfm.ForecastConfig(max_context=10240,max_horizon=128,per_core_batch_size=8,normalize_inputs=True,use_continuous_quantile_head=True,force_flip_invariance=True,infer_is_positive=True,fix_quantile_crossing=True))
  def forecast(i):
   with torch.inference_mode(),torch.autocast(device_type='cpu',dtype=torch.bfloat16,enabled=bf16):
    point,_=pipe.forecast(horizon=60,inputs=[p[max(0,i+1-context):i+1] for p in data['prices']])
   return np.asarray(point).reshape(35,60)
 cold=time.perf_counter()-start
 progress=Path(output_path+'.progress.json');pred_path=Path(output_path+'.pred.npy')
 if progress.exists() and pred_path.exists():
  state=json.loads(progress.read_text());pred=np.load(pred_path)
  assert state['model']==name and state['origins']==data['origins']
  assert state.get('cpu_threads')==THREADS, 'Checkpoint CPU profile differs; choose a fresh output path'
  assert state.get('data_hash')==hashlib.sha256(data['prices'].tobytes()).hexdigest(), 'Checkpoint data differs'
 else:
  state=dict(model=name,cpu_threads=THREADS,data_hash=hashlib.sha256(data['prices'].tobytes()).hexdigest(),origins=data['origins'],cold_load_s=cold,first_batch_s=None,warm_batch_s=[],accuracy_batch_s=[],completed_origins=0,precision='bfloat16' if bf16 else 'float32')
  pred=np.full((35,len(data['origins']),4),np.nan)
 def save():
  np.save(pred_path,pred);progress.write_text(json.dumps(state,indent=2)+'\n')
 save()
 if state['first_batch_s'] is None:
  start=time.perf_counter();forecast(len(data['stamps'])-1);state['first_batch_s']=time.perf_counter()-start;save()
 print('loaded',name,'cold_s',cold,'first_batch_s',state['first_batch_s'],flush=True)
 while len(state['warm_batch_s'])<3:
  start=time.perf_counter();forecast(len(data['stamps'])-1);state['warm_batch_s'].append(time.perf_counter()-start);save();print('warm',name,state['warm_batch_s'][-1],flush=True)
 for k in range(state['completed_origins'],len(data['origins'])):
  i=data['origins'][k];start=time.perf_counter();out=forecast(i);elapsed=time.perf_counter()-start
  pred[:,k,:]=out[:,[h-1 for h in HORIZONS]]
  state['accuracy_batch_s'].append(elapsed);state['completed_origins']=k+1;save()
  print('scored',name,k+1,'seconds',elapsed,flush=True)
 runs=state['warm_batch_s']
 return dict(model=name,status='complete',fitting_s=0,cold_load_s=state['cold_load_s'],first_batch_s=state['first_batch_s'],precision=state['precision'],context_limit=context,warm_batch_s=runs,warm_median_s=float(np.median(runs)),warm_p95_s=float(np.percentile(runs,95)),accuracy_batch_s=state['accuracy_batch_s'],**metrics(data,pred))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');parser.add_argument('--model',required=True);args=parser.parse_args()
 start=time.perf_counter();data=prepare(args.input)
 metadata=dict(stocks=35,horizons=HORIZONS,origins=[int(data['stamps'][i]) for i in data['origins']],data_start=int(data['stamps'][0]),data_end=int(data['stamps'][-1]),cpu_threads=THREADS,gpu=False,platform=platform.platform(),feature_preparation_s=time.perf_counter()-start)
 try:
  if args.model=='No change':
   pred=np.repeat(data['prices'][:,data['origins'],None],4,axis=2);result=dict(model=args.model,status='complete',fitting_s=0,warm_median_s=0,**metrics(data,pred));result['direction_accuracy']=None
   for item in result['by_horizon']:item['direction_accuracy']=None
  else:result=neural(data,args.model,args.output) if args.model.startswith(('Chronos','TimesFM')) else classical(data,args.model)
 except Exception as exc:
  import traceback;traceback.print_exc();result=dict(model=args.model,status='failed',error_type=type(exc).__name__,error=str(exc)[:1000])
 Path(args.output).write_text(json.dumps({**metadata,**result},indent=2)+'\n');print(json.dumps(result),flush=True)
 if result['status']=='failed':sys.exit(2)
