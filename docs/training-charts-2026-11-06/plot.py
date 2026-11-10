from pathlib import Path
import json,csv
from datetime import datetime,timedelta
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
RUN=ROOT/'.worktrees/controlled-ablations/stockmarket-training/runs/training-cycle-2026-11-05'
OUT=Path(__file__).resolve().parent
name='regularized-seed19073'
read=lambda p:json.loads(p.read_text())
start=datetime.fromisoformat('2026-11-05T23:44:42.748932+00:00')
selected=read(RUN/name/'selection.json')
sel_step=int(Path(selected['checkpoint']).parent.name.split('-')[-1])
baseline=read(RUN/'replay-seed19073/selection.json')
rows=[]
for step,s in [(0,baseline)]+[(int(p.parent.name.split('-')[-1]),read(p)) for p in (RUN/name).glob('validation-*/summary.json')]:
    if not s['complete']:continue
    # Evaluation start reconstructed from logged completion and evaluation duration.
    stamp=start if step==0 else datetime.fromisoformat(s['updatedAt'])-timedelta(seconds=s['elapsedSeconds'])
    rows.append(dict(decisions=step,hours=(stamp-start).total_seconds()/3600,primary=100*s['primary'],**{t:100*s['tiers'][t]['pairwise'] for t in ['easy','medium','hard']}))
rows.sort(key=lambda r:r['decisions'])
assert len(rows)==16 and sel_step in [r['decisions'] for r in rows]
with (OUT/'validation-history.csv').open('w') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
x=np.array([r['hours'] for r in rows]);best=next(r for r in rows if r['decisions']==sel_step)
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'axes.spines.top':False,'axes.spines.right':False,'axes.titleweight':'bold','axes.labelcolor':'#334155','text.color':'#0f172a','axes.edgecolor':'#cbd5e1','figure.facecolor':'#f8fafc','axes.facecolor':'#ffffff','savefig.facecolor':'#f8fafc'})
fig,axs=plt.subplots(1,2,figsize=(14,5.5))
for ax in axs:
    ax.grid(axis='y',alpha=.18);ax.set_xlabel('Hours since fine-tuning began (includes evaluation)');ax.set_ylabel('Pairwise finishing score (%)')
    ax.axvline(best['hours'],color='#94a3b8',ls=':',lw=1.5)
axs[0].plot(x,[r['primary'] for r in rows],'-o',color='#2563eb',lw=2,ms=4,label='Evaluated checkpoint')
axs[0].step(x,np.maximum.accumulate([r['primary'] for r in rows]),where='post',color='#0d9488',alpha=.7,ls='--',label='Best observed so far')
axs[0].scatter(best['hours'],best['primary'],marker='*',s=220,color='#f59e0b',edgecolor='#92400e',zorder=5)
axs[0].annotate(f"Selected: {best['primary']:.2f}%\n{best['decisions']/1e6:.2f}M decisions",(best['hours'],best['primary']),xytext=(-95,-60),textcoords='offset points',arrowprops={'arrowstyle':'-','color':'#64748b'})
axs[0].set_title('Overall validation performance',loc='left');axs[0].legend(loc='lower right',frameon=False);axs[0].set_ylim(55,73)
for t,c in [('easy','#0d9488'),('medium','#2563eb'),('hard','#9333ea')]:axs[1].plot(x,[r[t] for r in rows],'-o',label=t.title(),color=c,lw=2,ms=4)
axs[1].set_title('Validation performance by opponent difficulty',loc='left');axs[1].legend(frameon=False,loc='lower right');axs[1].set_ylim(45,96)
fig.suptitle('Best learned entrant · PPO + imitation · seed19073',fontsize=18,x=.06,ha='left')
fig.text(.06,.035,'0 h = inherited replay checkpoint. Points are saved evaluations; connecting lines are visual guides.\nSame validation deals reused: 256 Medium + 256 Hard + 128 Easy. Scores are not game-win rates.',fontsize=10,color='#475569')
fig.tight_layout(rect=[.02,.12,.99,.92]);fig.savefig(OUT/'training-performance.png',dpi=170);fig.savefig(OUT/'training-performance.svg');plt.close(fig)
final=[]
for n,label in [('replay-seed19073','Starting replay model'),(name,'Selected PPO + imitation'),('morgan-hard','Morgan Hard')]:
    s=read(RUN/'final'/n/'summary.json');final.append((label,100*s['primary']))
fig,ax=plt.subplots(figsize=(10,3.8));ys=np.arange(3)
ax.barh(ys,[v for _,v in final],color=['#94a3b8','#2563eb','#0d9488'],height=.55)
ax.set_yticks(ys,[label for label,_ in final]);ax.invert_yaxis();ax.set_xlim(0,80);ax.set_xlabel('Primary pairwise finishing score (%)');ax.grid(axis='x',alpha=.15);ax.set_axisbelow(True)
for y,(_,v) in zip(ys,final):ax.text(v+.7,y,f'{v:.2f}%',va='center',fontweight='bold')
ax.set_title('Independent final test · selected checkpoint versus references',loc='left',pad=18)
fig.text(.03,.025,'512 Medium + 512 Hard deals per entrant. Separate from the validation curve; no uncertainty intervals shown.',fontsize=9,color='#475569')
fig.tight_layout(rect=[0,.07,1,1]);fig.savefig(OUT/'final-test.png',dpi=170);fig.savefig(OUT/'final-test.svg');plt.close(fig)
print(json.dumps({'initial':rows[0],'selected':best,'last_evaluated':rows[-1],'final_test':final},indent=2))
(OUT/'README.md').write_text('# Best model training curves\n\nPPO + imitation, seed19073: strongest learned entrant in the fresh 60-entrant competition. This does not establish superiority to Morgan or other nearby models.\n\nThe timeline covers fine-tuning only. At zero hours, the inherited replay checkpoint uses its existing validation result. Later timestamps are evaluation completion minus evaluation duration, relative to the recorded worker launch; they approximate checkpoint evaluation start, include evaluation overhead, and are not pure optimizer time. All 15 complete fine-tuning validation checkpoints are included. Training continued beyond the last evaluated checkpoint; that unevaluated tail is not extrapolated.\n\nPrimary = equal-weight Medium/Hard pairwise finishing score. Curves reuse validation deals and drove checkpoint selection; final-test scores use a separate set. No curve smoothing or confidence claims are applied. The final bar chart shows point estimates, not a significance test.\n\nSources: `'+str(RUN/name)+'`, the replay seed19073 selection, and the three final evaluation summaries.\n\nRecreate with the training virtual environment: `python docs/training-charts-2026-11-06/plot.py`. Data: `validation-history.csv`.\n')
