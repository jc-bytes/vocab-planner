import { integer, fail } from './contract.js';
export class ScoredTimer {
    constructor({ now = () => performance.now(), recordedMilliseconds = 0 } = {}) { this.now=now; this.total=integer(recordedMilliseconds); this.opened=null; }
    resume() { if (this.opened === null) this.opened=this.now(); }
    snapshot() { const delta=this.opened === null ? 0 : Math.floor(this.now()-this.opened); if (delta<0) fail('INVALID_TIME'); return integer(this.total+delta); }
    pause() { this.total=this.snapshot(); this.opened=null; return this.total; }
    restore(total) { this.total=integer(total); this.opened=null; }
}
