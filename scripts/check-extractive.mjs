import {pipeline,env} from '@huggingface/transformers';
env.cacheDir='.runtime/model-cache';env.allowLocalModels=false;
const qa=await pipeline('question-answering','Xenova/distilbert-base-cased-distilled-squad',{dtype:'q8'});
const context='In this synthetic study, the first-ranked compound is FZ-2078, with predicted synthetic pIC50 of 9.860 and tree standard deviation of 0.141. These are entirely synthetic model predictions, not measured biological results. The random forest ranks compounds by predicted synthetic pIC50 from highest to lowest. Tree standard deviation reports uncalibrated disagreement among the 64 decision trees, not a confidence interval.';
for(const question of ['Which compound ranks first?','Are these measured biological results?','What does tree standard deviation report?'])console.log(question,await qa(question,context));
const embed=await pipeline('feature-extraction','Xenova/all-MiniLM-L6-v2',{dtype:'q8'});console.log('Embedding shape',(await embed(['Which compound ranks first?',context],{pooling:'mean',normalize:true})).dims);
