import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
const EMBED='Xenova/all-MiniLM-L6-v2',QA='Xenova/distilbert-base-cased-distilled-squad';
const EMBED_REV='751bff37182d3f1213fa05d7196b954e230abad9',QA_REV='bdbb0a5e9c617c3c7ea9f3cbaf2be3ad871bcd7d';
let embed,answerer,embedLoading,qaLoading;
const progress=p=>postMessage({type:'progress',status:p.status,file:p.file,progress:p.progress});
async function loadEmbed(){if(embed)return embed;if(!embedLoading)embedLoading=pipeline('feature-extraction',EMBED,{revision:EMBED_REV,device:'wasm',dtype:'q8',progress_callback:progress}).then(m=>{embed=m;postMessage({type:'ready',model:EMBED});return m}).catch(e=>{embedLoading=null;throw e});return embedLoading}
async function loadQA(){if(answerer)return answerer;if(!qaLoading)qaLoading=pipeline('question-answering',QA,{revision:QA_REV,device:'wasm',dtype:'q8',progress_callback:progress}).then(m=>{answerer=m;return m}).catch(e=>{qaLoading=null;throw e});return qaLoading}
const cosine=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
async function vectors(texts){return(await(await loadEmbed())(texts,{pooling:'mean',normalize:true})).tolist()}
self.onmessage=async({data})=>{const {id,type,facts,question}=data;try{
 if(!Array.isArray(facts)||!facts.length)throw new Error('No study evidence was supplied.');
 postMessage({type:'generating',id});
 if(type==='summarise'){
  const goals=['Which compound is first ranked with the highest predicted synthetic activity?','How are model uncertainty and validation error reported?','What are the limitations of artificial synthetic data for real antiviral treatment?'];
  if(facts.some(f=>f.id==='T01'))goals.splice(1,0,'What are the selected target profile parameters and their normalised weights?');
  const embeddings=await vectors([...facts.map(f=>f.text),...goals]);const used=new Set(),selected=[];
  goals.forEach((q,i)=>{const scores=facts.map((f,j)=>({...f,relevance:cosine(embeddings[j],embeddings[facts.length+i])})).filter(f=>!used.has(f.id)&&(i!==0||f.id.startsWith('C'))).sort((a,b)=>b.relevance-a.relevance);const best=scores[0];used.add(best.id);selected.push(best)});
  postMessage({type:'result',id,model:EMBED,revision:EMBED_REV,method:'neural extractive summary',items:selected,text:selected.map((f,i)=>`${i+1}. ${f.text} [${f.id}]`).join('\n\n')});return;
 }
 if(type!=='answer')throw new Error('Unsupported AI operation.');
 const questions=(question.match(/[^?]+\??/g)||[question]).map(q=>q.trim()).filter(Boolean).slice(0,3);const output=[];
 for(const q of questions){
  const scopeQuestion=/\b(cure|treat|treatment|effective|safe|safety|patient|dose|dosage|prescribe)\b/i.test(q);
  const eligible=scopeQuestion?facts.filter(f=>f.scope):facts;
  const embeddings=await vectors([...eligible.map(f=>f.text),q]);const query=embeddings.at(-1);
  const retrieved=eligible.map((f,i)=>({...f,relevance:cosine(embeddings[i],query)})).sort((a,b)=>b.relevance-a.relevance).slice(0,3);
  if(!retrieved.length||retrieved[0].relevance<.2){output.push({question:q,answer:null,evidence:[],reason:'No sufficiently relevant study evidence was found.'});continue}
  const context=retrieved.map(f=>f.text).join(' ');const qa=await loadQA();const span=await qa(q,context);
  const answer=span.score>=.04?span.answer.replace(/FZ\s*-\s*(\d+)/gi,'FZ-$1'):null;
  output.push({question:q,answer,spanScore:span.score,evidence:retrieved,reason:answer?null:'No sufficiently supported answer span was found.'});
 }
 postMessage({type:'result',id,model:QA,revision:QA_REV,method:'neural retrieval + extractive question answering',answers:output,text:output.map((a,i)=>`${output.length>1?'Question '+(i+1)+': ':''}${a.answer||a.reason}\n\n${a.evidence.map(e=>`Evidence [${e.id}]: ${e.text}`).join('\n')}`).join('\n\n')});
}catch(e){postMessage({type:'error',id,error:e.message||String(e)})}};
