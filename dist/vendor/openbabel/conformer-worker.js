/* Browser-only visualization conformers. Never used by screening or exports. */
let runtime;
function loadOpenBabel() {
  if (runtime) return runtime;
  runtime = new Promise((resolve, reject) => {
    try {
      importScripts('./openbabel.js');
      self.__$openBabelInitialized$__ = ({module}) => resolve({module});
      let instance;
      instance = OpenBabelModule({
        locateFile: file => new URL('./' + file, self.location.href).href,
        onRuntimeInitialized: () => resolve({module:instance}),
        onAbort: () => reject(new Error('The local chemistry engine could not start.')),
        print: () => {}, printErr: () => {}
      });
    } catch (error) { reject(error); }
  });
  return runtime;
}
function write(m, mol, format) {
  const conv = new m.ObConversionWrapper();
  try {
    conv.setOutFormat('', format);
    if (!conv.writeToOutput(mol)) throw new Error('Could not serialize the selected structure.');
    return conv.getOutStr();
  } finally { conv.delete(); }
}
function validateMolBlock(block) {
  const lines = block.split(/\r?\n/);
  const count = Number(lines[3]?.slice(0,3));
  const bonds = Number(lines[3]?.slice(3,6));
  if (!count || count > 300 || !bonds || !lines[3].includes('V2000')) throw new Error('Unsupported conformer format.');
  const atoms = lines.slice(4,4+count).map(line => ({x:Number(line.slice(0,10)),y:Number(line.slice(10,20)),z:Number(line.slice(20,30)),element:line.slice(31,34).trim()}));
  if (atoms.some(a => !a.element || ![a.x,a.y,a.z].every(Number.isFinite))) throw new Error('The generated coordinates are invalid.');
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  for (const line of lines.slice(4+count,4+count+bonds)) {
    const a = atoms[Number(line.slice(0,3))-1], b = atoms[Number(line.slice(3,6))-1];
    if (!a || !b || distance(a,b)<0.6 || distance(a,b)>2.8) throw new Error('The generated geometry failed a bond-length check.');
  }
  for (let i=0;i<atoms.length;i++) for(let j=i+1;j<atoms.length;j++) {
    if(distance(atoms[i],atoms[j])<0.55) throw new Error('The generated geometry contains overlapping atoms.');
  }
  return {atomCount:count,bondCount:bonds,elements:[...new Set(atoms.map(a=>a.element))]};
}
self.onmessage = async ({data}) => {
  const {id,smiles} = data;
  let mol, conv;
  try {
    if(typeof smiles!=='string' || !smiles.trim() || smiles.length>2000 || /[\r\n]/.test(smiles)) throw new Error('No supported SMILES structure was supplied.');
    self.postMessage({id,type:'progress',text:'Loading the browser chemistry engine…'});
    const {module:m} = await loadOpenBabel();
    conv = new m.ObConversionWrapper();
    conv.setInFormat('', 'smi');
    mol = new m.OBMol();
    if(!conv.readString(mol,smiles) || !mol.NumAtoms() || mol.NumAtoms()>150) throw new Error('The selected SMILES could not be read reliably.');
    const identity = write(m,mol,'can').trim().split(/\s/)[0];
    self.postMessage({id,type:'progress',text:'Preparing a 3D conformer from this compound’s SMILES…'});
    const gen = new m.OB3DGenWrapper();
    try { gen.generate3DStructure(mol,'MMFF94'); } finally { gen.delete(); }
    const generatedIdentity = write(m,mol,'can').trim().split(/\s/)[0];
    if(!identity || identity!==generatedIdentity) throw new Error('The generated conformer did not preserve the molecular identity.');
    const molblock = write(m,mol,'mol');
    const geometry = validateMolBlock(molblock);
    self.postMessage({id,type:'result',molblock,identity,sourceSmiles:smiles,...geometry});
  } catch(error) {
    self.postMessage({id,type:'error',error:error.message || 'A reliable 3D conformer could not be prepared.'});
  } finally { mol?.delete(); conv?.delete(); }
};
