/** Browser scheduler, not a CPU. It gives WASM bounded work and yields every frame.
 * A hidden tab pauses in app.js. Slow frames never accumulate unlimited debt.
 * Sys.wait stays interpreted: instruction budgets therefore affect game speed.
 */
// Original jackvm-rs web player baseline, documented by jackvm-py/player.py.
export const ORIGINAL_INSTRUCTIONS_PER_FRAME=40000;
export class Player {
  constructor(runtime,display,keyboard) {
    Object.assign(this,{runtime,display,keyboard,instructionBudget:ORIGINAL_INSTRUCTIONS_PER_FRAME,isRunning:false,
      lastFrameTime:0,frameCount:0,raf:null,onFrame:null,onStatusChange:null});
  }
  setBudget(value) { this.instructionBudget=Math.max(1000,Math.min(1000000,value)); }
  isPlaying() { return this.isRunning; }
  start() {
    if(this.isRunning) return;
    this.isRunning=true;this.lastFrameTime=performance.now();
    const tick=now=>{
      if(!this.isRunning) return;
      // At 60 Hz the user-selected budget is exact. Cap catch-up at three frames.
      const elapsed=Math.max(0,Math.min(50,now-this.lastFrameTime));this.lastFrameTime=now;
      let remaining=Math.floor(this.instructionBudget*elapsed/(1000/60));
      const deadline=performance.now()+8;
      this.runtime.setKey(this.keyboard.getKey());
      try {
        while(remaining>0 && performance.now()<deadline) {
          const slice=Math.min(4096,remaining);remaining-=slice;
          const result=this.runtime.run(slice,now);
          if(result!==0) {
            this.stop();this.onStatusChange?.(result===1?'Halted':`Fault (code ${this.runtime.error})`);break;
          }
        }
        this.display.render(this.runtime.ram);
        // Source panes can be large (the chess opening book). Don't rebuild at 60 Hz.
        this.frameCount++;
        if(this.frameCount%6===0 || !this.isRunning) this.onFrame?.();
      } catch(error) {this.stop();this.onStatusChange?.(`Runtime error: ${error.message}`);}
      if(this.isRunning) this.raf=requestAnimationFrame(tick);
    };
    this.raf=requestAnimationFrame(tick);
  }
  stop() {this.isRunning=false;if(this.raf!==null) cancelAnimationFrame(this.raf);this.raf=null;}
  step(now=performance.now()) {
    this.runtime.setKey(this.keyboard.getKey());
    const result=this.runtime.step(now);this.display.render(this.runtime.ram);return result;
  }
  getFrameCount() {return this.frameCount;}
}
