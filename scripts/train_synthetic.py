"""Train reproducible synthetic QSAR models. NO biological measurements are used."""
from pathlib import Path
import json, math, hashlib, random, datetime
import numpy as np
from rdkit import Chem, rdBase, RDLogger
RDLogger.DisableLog("rdApp.error")
from rdkit.Chem import Descriptors, rdMolDescriptors, rdFingerprintGenerator
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import sklearn
ROOT=Path(__file__).resolve().parents[1]
rng=np.random.default_rng(2302)
random.seed(2302)
subs=['C','CC','CCC','O','CO','CCO','N','CN','CCN','F','Cl','Br','C#N','C(=O)N','C(=O)O','S(=O)(=O)N','OC','C(F)(F)F','C(=O)C','N(C)C']
cores=['{a}c1cc({b})cc({c})c1','{a}c1nc({b})cc({c})n1','{a}c1cc({b})nc({c})c1','{a}c1ccc2cc({b})cc({c})c2c1','{a}C1CC({b})CC({c})C1','{a}c1nc({b})nc({c})n1']
generator=rdFingerprintGenerator.GetMorganGenerator(radius=2,fpSize=256)
feature_names=['Molecular weight','LogP','Polar surface area','H-bond donors','H-bond acceptors','Rotatable bonds','Fraction sp3','Aromatic rings']+[f'Morgan bit {i}' for i in range(256)]
mols={}
while len(mols)<2400:
    core=random.randrange(len(cores)); a,b,c=random.choices(subs,k=3)
    mol=Chem.MolFromSmiles(cores[core].format(a=a,b=b,c=c))
    if mol is None:continue
    smiles=Chem.MolToSmiles(mol)
    if smiles in mols:continue
    desc=[Descriptors.MolWt(mol),Descriptors.MolLogP(mol),rdMolDescriptors.CalcTPSA(mol),rdMolDescriptors.CalcNumHBD(mol),rdMolDescriptors.CalcNumHBA(mol),rdMolDescriptors.CalcNumRotatableBonds(mol),rdMolDescriptors.CalcFractionCSP3(mol),rdMolDescriptors.CalcNumAromaticRings(mol)]
    fp=list(generator.GetFingerprint(mol))
    mols[smiles]={'smiles':smiles,'core':core,'features':[round(float(x),6) for x in desc]+fp}
records=list(mols.values())
for i,r in enumerate(records):r['id']=f'FZ-{i+1:04d}';r['name']=f'Candidate {i+1:04d}'
X=np.array([r['features'] for r in records]); train,remaining=train_test_split(np.arange(len(records)),test_size=.3,random_state=2302); valid,library=train_test_split(remaining,test_size=.5,random_state=2303)
# Synthetic target-specific response surfaces. These are artificial rules, not biology.
def response(x,k):
    mw,lp,psa,hbd,hba,rot,sp3,ar=x[:,:8].T
    opt=[(300,2.3,75),(245,1.2,100),(365,3.2,65)][k]
    v=8.3-.000017*(mw-opt[0])**2-.22*(lp-opt[1])**2-.00016*(psa-opt[2])**2-.05*rot+.18*np.minimum(hba,5)
    v+= [.3,-.25,.65][k]*sp3 + [.1,.22,-.2][k]*ar + [.22,.35,-.13][k]*hbd
    v+=.25*np.sin(psa/20+k)+rng.normal(0,.22,len(x))
    return np.clip(v,2,10)
models={}; metadata=[]; expected={}; datasets={}
for k,(key,virus,target) in enumerate([('sars','SARS-CoV-2','Main protease (Mpro)'),('flu','Influenza A','Neuraminidase'),('hcv','Hepatitis C virus','NS3/4A protease')]):
    y=response(X,k)
    model=RandomForestRegressor(n_estimators=64,max_depth=10,min_samples_leaf=3,max_features=.75,random_state=2302+k,n_jobs=-1)
    model.fit(X[train],y[train]); pred=model.predict(X[valid]); baseline=float(np.sqrt(mean_squared_error(y[valid],np.full(len(valid),y[train].mean()))))
    trees=[]
    for tree in model.estimators_:
        t=tree.tree_;trees.append({'l':t.children_left.tolist(),'r':t.children_right.tolist(),'f':t.feature.tolist(),'t':[round(float(x),7) for x in t.threshold],'v':[round(float(x),7) for x in t.value[:,0,0]]})
    info={'id':f'fairouz-synthetic-rf-{key}-v2','key':key,'virus':virus,'target':target,'algorithm':'Random forest regression','endpoint':'Synthetic pIC50','units':'-log10(mol/L), synthetic labels only','nTrain':len(train),'nValidation':len(valid),'nCandidates':len(library),'trees':64,'seed':2302+k,'rmse':round(float(np.sqrt(mean_squared_error(y[valid],pred))),4),'mae':round(float(mean_absolute_error(y[valid],pred)),4),'r2':round(float(r2_score(y[valid],pred)),4),'baselineRmse':round(baseline,4),'split':'Molecule-disjoint random split; not scaffold, temporal or external validation','dataType':'Entirely synthetic structures and generated activity labels; no measured antiviral data','uncertainty':'Standard deviation across trees, uncalibrated; not a confidence interval','trainingLabelRange':[round(float(min(y[train])),3),round(float(max(y[train])),3)],'featureImportance':[{'feature':feature_names[j],'importance':round(float(model.feature_importances_[j]),4)} for j in np.argsort(model.feature_importances_)[-8:][::-1]]}
    artifact={'metadata':info,'featureNames':feature_names,'trees':trees}
    artifact_text=json.dumps(artifact,separators=(',',':'));info['artifactSha256']=hashlib.sha256(artifact_text.encode()).hexdigest()
    (ROOT/'dist/models'/f'{key}.json').write_text(artifact_text,encoding='utf8')
    models[key]=info;expected[key]=[{'id':records[j]['id'],'mean':float(model.predict(X[j:j+1])[0]),'sd':float(np.std([t.predict(X[j:j+1])[0] for t in model.estimators_]))} for j in library[:10]]
    datasets[key]={'train':[[records[j]['id'],round(float(y[j]),5)] for j in train],'validation':[[records[j]['id'],round(float(y[j]),5)] for j in valid]}
# No generated labels for the unseen candidate library are published as measurements.
package={'schemaVersion':2,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'synthetic':True,'seed':2302,'features':feature_names,'models':models,'library':[records[j] for j in library],'trainingReferences':[{'id':records[j]['id'],'smiles':records[j]['smiles'],'fingerprint':records[j]['features'][8:],'labels':{key:next(v for id,v in ds['train'] if id==records[j]['id']) for key,ds in datasets.items()}} for j in train], 'licenses':{'trainingData':'Synthetic dataset generated for Fairouz; CC0-1.0','code':'MIT','rdkit':'BSD-3-Clause','scikitLearn':'BSD-3-Clause'}}
(ROOT/'dist/research-data.json').write_text(json.dumps(package,separators=(',',':')),encoding='utf8')
(ROOT/'data/validation-fixtures.json').write_text(json.dumps(expected),encoding='utf8')
(ROOT/'data/synthetic-labels.json').write_text(json.dumps(datasets,separators=(',',':')),encoding='utf8')
(ROOT/'data/model-card.json').write_text(json.dumps({'models':models,'versions':{'rdkit':rdBase.rdkitVersion,'sklearn':sklearn.__version__},'dataGeneration':'scripts/train_synthetic.py','datasetSha256':hashlib.sha256(json.dumps(records,separators=(',',':')).encode()).hexdigest(),'limitations':['No real biological labels','No clinical or experimental validation','Validation describes recovery of an artificial response surface only','Uncalibrated tree disagreement','No target-sequence generalisation; only three synthetic contexts']},indent=2),encoding='utf8')
print(json.dumps({k:{f:v[f] for f in ['nTrain','nValidation','nCandidates','rmse','baselineRmse','r2']} for k,v in models.items()},indent=2))
