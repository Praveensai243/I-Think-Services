/* =====================================================================
   I THINK SERVICES — Interactions v3
   Voice-agent demo · live console · concurrent-calls · booking calendar
   Vanilla JS, no dependencies. Every module is feature-guarded.
   ===================================================================== */
(function(){
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var $  = function(s,c){return (c||document).querySelector(s);};
  var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};

  /* -------------------------------------------------- mobile nav + chrome */
  var burger = $("#burger"), links = $("#links");
  if(burger && links){
    burger.addEventListener("click", function(){
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open);
    });
    $$("a", links).forEach(function(a){
      a.addEventListener("click", function(){ links.classList.remove("open"); burger.setAttribute("aria-expanded","false"); });
    });
  }
  var nav = $("header.nav"), progress = $(".progress");
  function onScroll(){
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if(nav) nav.classList.toggle("scrolled", y > 12);
    if(progress){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y/h)*100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, {passive:true}); onScroll();

  /* -------------------------------------------------- cursor spotlight */
  var spot = $(".spotlight");
  if(spot && !RM && window.matchMedia("(pointer:fine)").matches){
    var sx=0, sy=0, cx=0, cy=0, raf=false;
    window.addEventListener("mousemove", function(e){
      sx=e.clientX; sy=e.clientY; spot.style.opacity="1";
      if(!raf){ raf=true; requestAnimationFrame(follow); }
    });
    function follow(){
      cx += (sx-cx)*0.12; cy += (sy-cy)*0.12;
      spot.style.transform = "translate("+cx+"px,"+cy+"px) translate(-50%,-50%)";
      if(Math.abs(sx-cx)>0.5 || Math.abs(sy-cy)>0.5){ requestAnimationFrame(follow); } else { raf=false; }
    }
  }

  /* -------------------------------------------------- reveal on scroll */
  var reveals = $$(".reveal");
  if(reveals.length){
    if(RM){ reveals.forEach(function(el){ el.classList.add("in"); }); }
    else {
      var io = new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } });
      }, {threshold:.12, rootMargin:"0px 0px -8% 0px"});
      reveals.forEach(function(el){ io.observe(el); });
    }
  }

  /* -------------------------------------------------- boot sequence (index) */
  var boot = $("#boot");
  if(boot){
    if(RM){ boot.classList.add("done"); }
    else {
      var lines=["initializing…","connecting phone lines","loading voice agents","ready"];
      var el = $(".blog", boot), i=0;
      var iv=setInterval(function(){ el.textContent=lines[i++]; if(i>=lines.length) clearInterval(iv); },240);
      setTimeout(function(){ boot.classList.add("done"); }, 1150);
      boot.addEventListener("click", function(){ boot.classList.add("done"); });
    }
  }

  /* -------------------------------------------------- count-up metrics */
  (function(){
    var ms = $$("[data-count]"); if(!ms.length) return;
    function run(node){
      var to = parseFloat(node.dataset.count), suf = node.dataset.suf||"", pre = node.dataset.pre||"", dur=1400, s=null;
      if(RM){ node.textContent = pre+to+suf; return; }
      requestAnimationFrame(function f(t){
        if(!s) s=t; var p=Math.min((t-s)/dur,1);
        var val = to * (1 - Math.pow(1-p,3));
        node.textContent = pre + (to % 1 ? val.toFixed(1) : Math.round(val)) + suf;
        if(p<1) requestAnimationFrame(f);
      });
    }
    var o = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ run(e.target); o.unobserve(e.target); } });
    }, {threshold:.5});
    ms.forEach(function(m){ o.observe(m); });
  })();

  /* -------------------------------------------------- HERO live console */
  (function(){
    var host = $("[data-console]"); if(!host) return;
    var rows   = $$(".line-row", host);
    var timerEl= $("[data-timer]", host);
    var sayEl  = $("[data-say]", host);
    var whoEl  = $("[data-active-who]", host);
    var counter= $("[data-live-count]", host);

    var states = [
      {cls:"ring", txt:"ringing"},
      {cls:"ans",  txt:"answered"},
      {cls:"book", txt:"booking"},
      {cls:"done", txt:"resolved"}
    ];
    var snippets = [
      {who:"Maria R. · new patient", say:"“Hi, I'd like to book a check-up for next week.”"},
      {who:"James T. · +1 (704)···", say:"“What time do you close on Saturdays?”"},
      {who:"Priya S. · returning", say:"“Can I move my Tuesday appointment to Thursday?”"},
      {who:"Alex D. · +1 (980)···", say:"“Do you take walk-ins today?”"}
    ];

    // seed each line at a random state
    rows.forEach(function(r){
      var s = Math.floor(Math.random()*states.length);
      r._s = s; paint(r);
    });
    function paint(r){
      var st = states[r._s];
      r.classList.toggle("on", st.cls!=="done");
      var pill = $(".pill", r);
      pill.className = "pill " + st.cls;
      pill.textContent = st.txt;
    }
    if(RM){ return; }

    // advance the lines
    setInterval(function(){
      var r = rows[Math.floor(Math.random()*rows.length)];
      r._s = (r._s+1) % states.length;
      paint(r);
    }, 1400);

    // live counter ticks up
    if(counter){
      var n = parseInt(counter.textContent,10) || 128;
      setInterval(function(){ n += Math.floor(Math.random()*3); counter.textContent = n; }, 2600);
    }

    // active-call timer + rotating transcript
    if(timerEl){
      var secs = 12;
      setInterval(function(){
        secs++; var m = Math.floor(secs/60), s = secs%60;
        timerEl.textContent = (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
      }, 1000);
    }
    if(sayEl && whoEl){
      var k=0;
      setInterval(function(){
        k=(k+1)%snippets.length;
        sayEl.style.opacity="0";
        setTimeout(function(){
          whoEl.textContent = snippets[k].who;
          sayEl.textContent = snippets[k].say;
          sayEl.style.opacity="1";
        }, 260);
      }, 3600);
    }
  })();

  /* -------------------------------------------------- INTERACTIVE voice demo */
  (function(){
    var demo = $("[data-demo]"); if(!demo) return;
    var chat   = $("[data-chat]", demo);
    var status = $("[data-demo-status]", demo);
    var scenarios = $$(".scenario", demo);

    // conversation scripts: {who:'cust'|'ai', text, book?}
    var scripts = {
      book: [
        {who:"cust", text:"Hi, I'd like to book a dental cleaning sometime next week."},
        {who:"ai",   text:"Of course! I have Tuesday at 10:00 AM or Thursday at 2:30 PM open. Which works better for you?"},
        {who:"cust", text:"Thursday afternoon is perfect."},
        {who:"ai",   text:"Great — booking you for Thursday, Aug 13 at 2:30 PM. Can I get a name and number for the confirmation?"},
        {who:"cust", text:"Maria Reyes, 704-555-0148."},
        {book:{title:"Appointment confirmed", rows:[["Service","Dental cleaning"],["When","Thu · Aug 13 · 2:30 PM"],["For","Maria Reyes"],["Reminder","Text + email sent"]]}},
        {who:"ai",   text:"All set, Maria! You'll get a text reminder the day before. Anything else I can help with?"}
      ],
      hours: [
        {who:"cust", text:"What are your hours this weekend?"},
        {who:"ai",   text:"We're open Saturday 9 AM–4 PM and closed Sunday. Would you like me to book you a Saturday slot?"},
        {who:"cust", text:"Yes, Saturday morning if possible."},
        {who:"ai",   text:"I have 9:30 AM or 11:00 AM available Saturday. Which would you prefer?"},
        {who:"cust", text:"Let's do 9:30."},
        {book:{title:"Appointment confirmed", rows:[["When","Sat · 9:30 AM"],["Duration","30 min"],["Confirmation","Sent by text"]]}}
      ],
      reschedule: [
        {who:"cust", text:"I need to move my Tuesday appointment."},
        {who:"ai",   text:"No problem — I see your cleaning booked Tuesday at 3 PM. What day works better?"},
        {who:"cust", text:"Can we do Friday instead?"},
        {who:"ai",   text:"Friday has 1:00 PM and 4:15 PM open. Which should I switch you to?"},
        {who:"cust", text:"1 PM, thanks."},
        {book:{title:"Appointment rescheduled", rows:[["From","Tue · 3:00 PM"],["To","Fri · 1:00 PM"],["Calendar","Updated automatically"]]}},
        {who:"ai",   text:"Done! Your appointment is now Friday at 1:00 PM. A new reminder is on its way."}
      ],
      question: [
        {who:"cust", text:"Do you accept Delta Dental insurance?"},
        {who:"ai",   text:"Yes, we're in-network with Delta Dental PPO. Cleanings and check-ups are typically covered at 100%."},
        {who:"cust", text:"Great. Is there parking on site?"},
        {who:"ai",   text:"There is — free patient parking right in front, plus a wheelchair-accessible entrance. Anything else?"},
        {who:"cust", text:"That's everything, thank you!"},
        {who:"ai",   text:"Happy to help. Have a wonderful day! 👋"}
      ],
      human: [
        {who:"cust", text:"Actually, I'd like to speak with a person about a billing issue."},
        {who:"ai",   text:"Absolutely — I'll connect you with our billing team right away. One moment while I transfer you."},
        {book:{title:"Warm transfer", rows:[["Routed to","Billing · Sarah"],["Context","Shared with agent"],["Wait time","< 20 sec"]]}},
        {who:"ai",   text:"You're being connected now. I've passed along everything so you won't need to repeat yourself."}
      ]
    };

    var timers = [], running=false, active="book";

    function clearAll(){ timers.forEach(clearTimeout); timers=[]; }
    function esc(t){ var d=document.createElement("div"); d.textContent=t; return d.innerHTML; }

    function typingEl(){
      var d=document.createElement("div"); d.className="typing";
      d.innerHTML="<i></i><i></i><i></i>"; return d;
    }
    function bubble(msg){
      var d=document.createElement("div");
      d.className="bubble "+(msg.who==="cust"?"cust":"ai");
      var lbl = msg.who==="cust" ? "Caller" : "AI Voice Agent";
      d.innerHTML='<span class="lbl">'+lbl+'</span>'+esc(msg.text);
      return d;
    }
    function bookCard(b){
      var d=document.createElement("div"); d.className="book-card";
      var rows = b.rows.map(function(r){ return '<div class="bc-row"><span>'+esc(r[0])+'</span><span>'+esc(r[1])+'</span></div>'; }).join("");
      d.innerHTML='<div class="bc-h"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'+esc(b.title)+'</div>'+rows;
      return d;
    }

    function play(key){
      clearAll();
      running=true;
      active=key;
      scenarios.forEach(function(s){ s.classList.toggle("active", s.dataset.scenario===key); });
      chat.innerHTML="";
      if(status) status.textContent="On call";
      var seq = scripts[key], t=300;

      if(RM){
        // render everything instantly for reduced motion
        seq.forEach(function(step){
          if(step.book){ var c=bookCard(step.book); chat.appendChild(c); c.classList.add("show"); }
          else { var b=bubble(step); chat.appendChild(b); b.classList.add("show"); }
        });
        if(status) status.textContent="Call resolved";
        running=false; return;
      }

      seq.forEach(function(step){
        if(step.who==="ai" || step.book){
          // show typing indicator first
          timers.push(setTimeout(function(){
            var tp=typingEl(); chat.appendChild(tp); scrollChat();
          }, t));
          t += 850;
          timers.push(setTimeout(function(){
            var tp=$(".typing", chat); if(tp) tp.remove();
            var node = step.book ? bookCard(step.book) : bubble(step);
            chat.appendChild(node); scrollChat();
            requestAnimationFrame(function(){ node.classList.add("show"); });
          }, t));
          t += (step.book ? 900 : Math.min(2600, 700 + step.text.length*22));
        } else {
          timers.push(setTimeout(function(){
            var node=bubble(step); chat.appendChild(node); scrollChat();
            requestAnimationFrame(function(){ node.classList.add("show"); });
          }, t));
          t += Math.min(2400, 650 + step.text.length*20);
        }
      });
      timers.push(setTimeout(function(){
        running=false;
        if(status) status.textContent="Call resolved";
      }, t));
    }
    function scrollChat(){ chat.scrollTop = chat.scrollHeight; }

    scenarios.forEach(function(s){
      s.addEventListener("click", function(){ play(s.dataset.scenario); });
    });

    // auto-start when scrolled into view
    var started=false;
    var o=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting && !started){ started=true; play("book"); } });
    }, {threshold:.35});
    o.observe(demo);
  })();

  /* -------------------------------------------------- concurrent calls visualizer */
  (function(){
    var vis = $("[data-calls]"); if(!vis) return;
    var nodes = $$(".cnode", vis);
    var live  = $("[data-calls-live]", vis);
    if(!nodes.length) return;
    if(RM){ nodes.forEach(function(n){ n.classList.add("on"); }); if(live) live.textContent=nodes.length; return; }

    function tick(){
      var target = 6 + Math.floor(Math.random()*(nodes.length-6)); // 6..N active
      // randomly assign on/off
      var order = nodes.slice().sort(function(){ return Math.random()-0.5; });
      order.forEach(function(n,idx){ n.classList.toggle("on", idx < target); });
      if(live) live.textContent = target;
    }
    var started=false;
    var o=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting && !started){ started=true; tick(); setInterval(tick, 1600); } });
    }, {threshold:.3});
    o.observe(vis);
  })();

  /* -------------------------------------------------- booking calendar */
  (function(){
    var cal = $("[data-cal]"); if(!cal) return;
    var slots = $$(".slot", cal).filter(function(s){ return !s.classList.contains("taken"); });
    var log = $("[data-cal-log]", cal);
    if(!slots.length) return;
    var names = ["Maria R.","James T.","Priya S.","Alex D.","Nina K.","Omar F.","Grace L.","Ben C."];
    if(RM){ slots.slice(0,3).forEach(function(s){ s.classList.add("booked"); }); if(log) log.innerHTML='<span class="dot"></span>AI booked 3 appointments'; return; }

    var booked=0;
    function book(){
      var open = slots.filter(function(s){ return !s.classList.contains("booked"); });
      if(!open.length){ // reset the demo
        slots.forEach(function(s){ s.classList.remove("booked"); }); booked=0;
        if(log) log.innerHTML='<span class="dot"></span>Schedule refreshed'; return;
      }
      var s = open[Math.floor(Math.random()*open.length)];
      var nm = names[Math.floor(Math.random()*names.length)];
      s.classList.add("booking");
      if(log) log.innerHTML='<span class="dot"></span>AI is booking '+s.dataset.time+'…';
      setTimeout(function(){
        s.classList.remove("booking"); s.classList.add("booked"); booked++;
        if(log) log.innerHTML='<span class="dot"></span>Booked '+s.dataset.time+' for '+nm+' · '+booked+' today';
      }, 900);
    }
    var started=false;
    var o=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting && !started){ started=true; setTimeout(book,600); setInterval(book, 2600); } });
    }, {threshold:.3});
    o.observe(cal);
  })();

  /* -------------------------------------------------- single-open FAQ */
  (function(){
    var qas = $$(".qa"); if(!qas.length) return;
    qas.forEach(function(d){
      d.addEventListener("toggle", function(){
        if(d.open){ qas.forEach(function(o){ if(o!==d) o.open=false; }); }
      });
    });
  })();

  /* -------------------------------------------------- contact form (AJAX) */
  (function(){
    var f = $("#contact-form"); if(!f) return;
    var s = $("#form-status"), btn = f.querySelector('button[type="submit"]');
    var label = btn ? btn.innerHTML : "Send message";
    function show(msg,color){ if(!s) return; s.style.display="block"; s.style.color=color; s.textContent=msg; }
    f.addEventListener("submit", function(e){
      e.preventDefault();
      if(btn){ btn.disabled=true; btn.innerHTML="Sending…"; }
      show("Transmitting your message…","var(--muted)");
      fetch("https://api.web3forms.com/submit",{method:"POST",headers:{Accept:"application/json"},body:new FormData(f)})
        .then(function(r){ return r.json(); })
        .then(function(d){ if(d.success){ show("Thanks — your message is in. We'll reply within one business day.","var(--flow)"); f.reset(); } else { throw new Error(d.message||"failed"); } })
        .catch(function(){ show("Couldn't send just now. Please email info@ithinkservices.net.","var(--live)"); })
        .finally(function(){ if(btn){ btn.disabled=false; btn.innerHTML=label; } });
    });
  })();

})();
