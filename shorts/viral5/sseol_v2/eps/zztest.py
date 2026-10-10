H = ["short","spiky","side","buzz","long","bob","pony","pigtails","bun","perm","bald"]
T = ["tee","hoodie","shirt","suit","cardigan","uniform","apron","dress","vest","gown"]
A = ["baby","kid","teen","adult","old"]
cast = {}
for i,h in enumerate(H): cast[f"h{i}"] = {"look": {"hairdo": h, "hair": "#e9e9ee" if h in ("perm","bald") else "#3a2a22", "age": "old" if h in ("perm","bald") else "adult", "top": "#7cc4ff", "glasses": h=="perm", "mustache": h=="bald"}}
for i,t in enumerate(T): cast[f"t{i}"] = {"look": {"topKind": t, "top": "#ff9eb5", "hairdo": "short"}}
for i,a in enumerate(A): cast[f"a{i}"] = {"look": {"age": a, "hairdo": "short"}}
cast["dog"] = {"look": {"kind": "dog", "hair": "#c98a4b", "acc": "collar"}}
beats = []
groups = [[f"h{i}" for i in range(0,4)],[f"h{i}" for i in range(4,8)],[f"h{i}" for i in range(8,11)]+["dog"],[f"t{i}" for i in range(0,4)],[f"t{i}" for i in range(4,8)],[f"t{i}" for i in range(8,10)]+["a0","a1"],["a2","a3","a4"]]
moods=["neutral","happy","shock","angry"]
for k,g in enumerate(groups):
    xs=[0.14,0.38,0.62,0.86][:len(g)] if len(g)==4 else [0.2,0.5,0.8,0.9][:len(g)]
    beats.append((f"l{k}","nar","테스트 문장입니다.","테스트", {"bg":"home","chars":[f"{c}:{moods[j%4]}@{xs[j]}*0.7" for j,c in enumerate(g)]}))
EP = {"title":"테스트","music":("hyperfun",0.1),"voices":{"nar":("SunHi","+28%")},"cast":cast,"beats":beats}
