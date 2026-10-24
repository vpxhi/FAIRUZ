/* Decorative UI effects only. No data or screening requests. */
const background=document.querySelector('.ambient');
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const finePointer=matchMedia('(pointer:fine)');
const stars=document.createElement('div');stars.className='ambient-particles';
for(let i=0;i<14;i++){
  const star=document.createElement('i');
  star.style.cssText=`--x:${(i*37+9)%100}%;--y:${(i*23+11)%100}%;--delay:-${i*2.7}s;--duration:${26+i%5*4}s`;
  stars.append(star);
}
background.append(stars);
const nodes=document.createElement('div');nodes.className='ambient-nodes';nodes.innerHTML='<svg viewBox="0 0 640 500" fill="none" aria-hidden="true"><path d="M80 140 230 60 390 130 520 80 600 260 440 400 270 340 110 430 80 140ZM230 60 270 340 390 130 440 400M80 140 390 130 600 260 270 340" stroke="currentColor"/><g fill="currentColor"><circle cx="80" cy="140" r="4"/><circle cx="230" cy="60" r="3"/><circle cx="390" cy="130" r="5"/><circle cx="520" cy="80" r="3"/><circle cx="600" cy="260" r="4"/><circle cx="440" cy="400" r="5"/><circle cx="270" cy="340" r="3"/><circle cx="110" cy="430" r="4"/></g></svg>';background.append(nodes);
const glow=document.createElement('div');glow.className='cursor-glow';background.append(glow);
let frame=0,position;
window.addEventListener('pointermove',event=>{
  if(reduce.matches||!finePointer.matches||document.hidden)return;
  position={x:event.clientX,y:event.clientY};
  if(!frame)frame=requestAnimationFrame(()=>{
    frame=0;if(!position)return;
    glow.style.transform=`translate3d(${position.x-250}px,${position.y-250}px,0)`;
  });
},{passive:true});
function visibility(){document.body.classList.toggle('page-inactive',document.hidden);if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0}}
document.addEventListener('visibilitychange',visibility);visibility();
