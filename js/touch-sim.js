/* Inside the phone frame, make the mouse act like a finger: drag to scroll/swipe, with a touch dot. */
(function(){
  if(window.top===window)return;
  var root=document.documentElement;
  var dot=document.createElement("div");
  dot.style.cssText="position:fixed;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(128,128,128,.35);border:1.5px solid rgba(255,255,255,.7);pointer-events:none;z-index:99999;opacity:0;transform:scale(.6);transition:transform .12s,opacity .12s";
  document.body.appendChild(dot);
  var st=document.createElement("style");
  st.textContent="html.embedded,html.embedded *{cursor:none!important}html.embedded{user-select:none}html.embedded input,html.embedded textarea{user-select:text}";
  document.head.appendChild(st);

  function place(e){dot.style.left=e.clientX+"px";dot.style.top=e.clientY+"px"}
  document.addEventListener("mousemove",function(e){place(e);dot.style.opacity=1},true);
  document.addEventListener("mouseleave",function(){dot.style.opacity=0});

  function scroller(el,axis){
    for(;el&&el!==document.body&&el!==root;el=el.parentElement){
      var cs=getComputedStyle(el),o=axis==="y"?cs.overflowY:cs.overflowX;
      var can=axis==="y"?el.scrollHeight>el.clientHeight+1:el.scrollWidth>el.clientWidth+1;
      if(can&&(o==="auto"||o==="scroll"))return el;
    }
    return axis==="y"?(document.scrollingElement||root):null;
  }

  var d=null,moved=false;
  function snap(el,on){if(el)el.style.scrollSnapType=on?"":"none"}
  document.addEventListener("pointerdown",function(e){
    if(e.pointerType!=="mouse"||e.button!==0)return;
    if(e.target.closest("input,textarea,select,[contenteditable]"))return;
    d={x:e.clientX,y:e.clientY,sy:scroller(e.target,"y"),sx:scroller(e.target,"x"),
       ty:0,tx:0,axis:null};
    if(d.sy)d.ty=d.sy.scrollTop;
    if(d.sx)d.tx=d.sx.scrollLeft;
    moved=false;dot.style.transform="scale(1)";
  },true);
  document.addEventListener("pointermove",function(e){
    if(!d||e.pointerType!=="mouse")return;
    var dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!moved&&Math.abs(dx)+Math.abs(dy)<6)return;
    if(!d.axis){/* lock to the dominant direction, like a real swipe */
      d.axis=Math.abs(dx)>Math.abs(dy)&&d.sx?"x":"y";
      snap(d.sx,false);snap(d.sy,false);
    }
    moved=true;
    if(d.axis==="y"&&d.sy)d.sy.scrollTop=d.ty-dy;
    if(d.axis==="x"&&d.sx)d.sx.scrollLeft=d.tx-dx;
  },true);
  function end(){
    if(d&&d.axis){/* hand control back to scroll-snap so it settles on a card */
      snap(d.sx,true);
      snap(d.sy,true);
    }
    d=null;dot.style.transform="scale(.6)"}
  document.addEventListener("pointerup",end,true);
  document.addEventListener("pointercancel",end,true);
  /* a drag is not a tap */
  document.addEventListener("click",function(e){
    if(moved){e.stopPropagation();e.preventDefault();moved=false}
  },true);
})();
