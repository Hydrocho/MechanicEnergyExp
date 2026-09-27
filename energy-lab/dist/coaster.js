// Constrained, frictionless point-mass motion. Rotation is not included.
// Integrate travel time along the track using v² = 2g(H − h).
class CoasterMotion {
  constructor(height, gravity = 9.8) {
    this.height = height;
    this.gravity = gravity;
    this.knots = [[0,1,-.45],[2,.08,0],[3.5,.55,0],[5,.05,0],[6.3,.3,0],[7.7,0,0],[9,0,0]];
    this.samples = [{x:0,t:0}];
    let previous = this.profile(0), speed = 0, time = 0;
    for (let i=1;i<=3600;i++) {
      const x=9*height*i/3600, current=this.profile(x);
      const nextSpeed=Math.sqrt(Math.max(0,2*gravity*(height-current.h)));
      const distance=Math.hypot(x-this.samples[i-1].x,current.h-previous.h);
      time+=2*distance/(speed+nextSpeed);
      this.samples.push({x,t:time});previous=current;speed=nextSpeed;
    }
    this.duration=time;
    this.flatStartTime=this.samples[3080].t; // x = 7.7 H, after the last descent.
    this.flatSpeed=Math.sqrt(2*gravity*height);
    this.collisionTime=this.flatStartTime+3;
    this.collisionX=7.7*height+3*this.flatSpeed;
  }
  profile(x) {
    const u=Math.max(0,Math.min(9,x/this.height));
    let i=0;while(i<this.knots.length-2 && u>this.knots[i+1][0])i++;
    const [a,ha,ma]=this.knots[i], [b,hb,mb]=this.knots[i+1];
    const d=b-a,t=(u-a)/d,t2=t*t,t3=t2*t;
    const h=(2*t3-3*t2+1)*ha+(t3-2*t2+t)*d*ma+(-2*t3+3*t2)*hb+(t3-t2)*d*mb;
    const slope=((6*t2-6*t)*ha+(3*t2-4*t+1)*d*ma+(-6*t2+6*t)*hb+(3*t2-2*t)*d*mb)/d;
    return {h:Math.max(0,h*this.height),slope};
  }
  at(time) {
    if(time>=this.collisionTime)return {x:this.collisionX,h:0,slope:0,speed:0,flat:true,done:true};
    if(time>=this.flatStartTime)return {x:7.7*this.height+(time-this.flatStartTime)*this.flatSpeed,h:0,slope:0,speed:this.flatSpeed,flat:true,done:false};
    if(time>=this.duration) {
      const speed=Math.sqrt(2*this.gravity*this.height);
      return {x:9*this.height+speed*(time-this.duration),h:0,slope:0,speed,flat:true};
    }
    const t=Math.max(0,Math.min(time,this.duration));
    let low=0,high=this.samples.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(this.samples[mid].t<=t)low=mid;else high=mid;}
    const a=this.samples[low],b=this.samples[high];
    // Squared interpolation in the first interval gives a smooth start from rest.
    let f=(t-a.t)/(b.t-a.t);if(low===0)f*=f;
    const x=a.x+(b.x-a.x)*f, {h,slope}=this.profile(x);
    return {x,h,slope,speed:Math.sqrt(Math.max(0,2*this.gravity*(this.height-h))),flat:false};
  }
}
