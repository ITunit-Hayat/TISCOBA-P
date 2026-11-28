import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Download,Package,RefreshCw,TrendingUp} from 'lucide-react';
import {readInventory} from '../services/googleSheetsApi';
import {EntreeItem,SortieItem} from '../types/stock';
type Lang='ar'|'fr';
const PK=['qty152Vert','qty152Bleu','qty152Noir','qty152KS','qty152KF','qty152Gris','qty124Vert','qty124Bleu'] as const;
const PL:Record<string,string>={qty152Vert:'152 Vert',qty152Bleu:'152 Bleu',qty152Noir:'152 Noir',qty152KS:'152 K.S',qty152KF:'152 K.F',qty152Gris:'152 Gris',qty124Vert:'124 Vert',qty124Bleu:'124 Bleu'};
function r2(v:number){return Math.round((v||0)*100)/100;}
function fmt(v:number){const r=r2(v);return r===0?'0.00':r.toFixed(2);}
function mo(d:string){return (d||'').slice(0,7);}
function ml(m:string,lang:Lang){if(!m)return '';const[y,mm]=m.split('-');const ar=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];const fr=['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];const n=lang==='ar'?ar:fr;const i=parseInt(mm,10)-1;return `${n[i]??mm} ${y}`;}
interface MR{month:string;pk:string;pl:string;e:number;s:number;b:number;rev:number;}
export default function MonthlyReportPage(){
const [lang,setLang]=useState<Lang>(()=>{try{return (localStorage.getItem('lang') as Lang)||'ar';}catch{return 'ar';}});
useEffect(()=>{try{localStorage.setItem('lang',lang);}catch{}},[lang]);
const [entrees,setEntrees]=useState<EntreeItem[]>([]);
const [sorties,setSorties]=useState<SortieItem[]>([]);
const [loading,setLoading]=useState(true);
const [error,setError]=useState<string|null>(null);
const [sp,setSp]=useState('all');
const [sm,setSm]=useState('all');
const isAr=lang==='ar';
const load=async()=>{setLoading(true);setError(null);try{const d=await readInventory();setEntrees(Array.isArray(d.entrees)?d.entrees:[]);setSorties(Array.isArray(d.sorties)?d.sorties:[]);}catch(e:any){setError(e?.message||(isAr?'تعذر تحميل البيانات':'Impossible de charger'));}finally{setLoading(false);}};
useEffect(()=>{load();},[]);
const months=useMemo(()=>{const set=new Set<string>();entrees.forEach(e=>set.add(mo(e.date)));sorties.forEach(s=>set.add(mo(s.date)));return Array.from(set).filter(Boolean).sort().reverse();},[entrees,sorties]);
const rows:MR[]=useMemo(()=>{
const map=new Map<string,MR>();const k=(m:string,p:string)=>`${m}|${p}`;
for(const p of PK) for(const m of months) map.set(k(m,p),{month:m,pk:p,pl:PL[p],e:0,s:0,b:0,rev:0});
entrees.forEach(e=>{const m=mo(e.date);for(const p of PK){const q=Number((e as any)[p])||0;if(q<=0)continue;const r=map.get(k(m,p));if(r){r.e+=q;r.b+=q;}}});
sorties.forEach(s=>{const m=mo(s.date);for(const p of PK){const q=Number((s as any)[p])||0;if(q<=0)continue;const r=map.get(k(m,p));if(r){r.s+=q;r.b-=q;}}});
const rm=new Map<string,number>();
sorties.forEach(s=>{const m=mo(s.date);const sq=PK.reduce((a,p)=>a+(Number((s as any)[p])||0),0);const mt=Number(s.montant)||0;for(const p of PK){const q=Number((s as any)[p])||0;if(q<=0||sq<=0)continue;const sh=mt*(q/sq);const kk=k(m,p);rm.set(kk,(rm.get(kk)||0)+sh);}});
rm.forEach((v,kk)=>{const r=map.get(kk);if(r)r.rev=v;});
let res=Array.from(map.values()).filter(r=>r.e>0||r.s>0);
if(sp!=='all') res=res.filter(r=>r.pk===sp);
if(sm!=='all') res=res.filter(r=>r.month===sm);
res.sort((a,b)=>b.month.localeCompare(a.month)||a.pl.localeCompare(b.pl));
return res;
},[entrees,sorties,months,sp,sm]);
const tot=useMemo(()=>{const t={e:0,s:0,rev:0};rows.forEach(r=>{t.e+=r.e;t.s+=r.s;t.rev+=r.rev;});return t;},[rows]);
const exportCSV=()=>{const h=isAr?['الشهر','المنتج','وارد (م)','صادر (م)','الرصيد (م)','المداخيل (دج)']:['Mois','Produit','Entree (m)','Sortie (m)','Solde (m)','Revenu (DZD)'];const lines=[h.join(',')];rows.forEach(r=>{lines.push([ml(r.month,lang),r.pl,fmt(r.e),fmt(r.s),fmt(r.b),r2(r.rev).toFixed(2)].join(','));});const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`rapport-mensuel-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);};
  return (
    <div dir={isAr?'rtl':'ltr'} className="min-h-screen bg-neutral-100/70 text-neutral-900 font-sans">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="w-9 h-9 rounded-xl bg-neutral-200 text-neutral-700 flex items-center justify-center hover:bg-neutral-300 transition" title={isAr?'رجوع':'Retour'}><ArrowLeft className="w-5 h-5" /></a>
            <div><h1 className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">{isAr?'تقرير شهري - نتائج وتفاصيل كل منتج':'Rapport mensuel - resultats et details par produit'}</h1><p className="text-[11px] text-neutral-500 font-medium leading-tight">{isAr?'8 منتجات - 152 و 124':'8 produits - 152 et 124'}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setLang(isAr?'fr':'ar')} className="px-2.5 py-1.5 text-xs font-bold border border-neutral-200 rounded-xl text-neutral-700 hover:bg-neutral-50 transition">{isAr?'FR':'عربي'}</button>
            <button onClick={load} disabled={loading} className="px-2.5 py-1.5 text-xs font-bold border border-neutral-200 rounded-xl text-neutral-700 hover:bg-neutral-50 transition flex items-center gap-1 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`} />{isAr?'تحديث':'Actualiser'}</button>
            <button onClick={exportCSV} className="px-2.5 py-1.5 text-xs font-bold border border-emerald-200 bg-emerald-50 rounded-xl text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 flex flex-wrap gap-3 items-end">
          <div><label className="block text-xs font-bold text-neutral-700 mb-1.5">{isAr?'المنتج':'Produit'}</label><select value={sp} onChange={(e)=>setSp(e.target.value)} className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium"><option value="all">{isAr?'جميع المنتجات':'Tous les produits'}</option>{PK.map(p=><option key={p} value={p}>{PL[p]}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-neutral-700 mb-1.5">{isAr?'الشهر':'Mois'}</label><select value={sm} onChange={(e)=>setSm(e.target.value)} className="px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl text-sm font-medium"><option value="all">{isAr?'جميع الأشهر':'Tous les mois'}</option>{months.map(m=><option key={m} value={m}>{ml(m,lang)}</option>)}</select></div>
          <div className="flex-1" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"><div className="text-[10px] font-bold text-emerald-800">{isAr?'وارد':'Entree'}</div><div className="text-sm font-black text-emerald-700 font-mono">{fmt(tot.e)} م</div></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2"><div className="text-[10px] font-bold text-blue-800">{isAr?'صادر':'Sortie'}</div><div className="text-sm font-black text-blue-700 font-mono">{fmt(tot.s)} م</div></div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><div className="text-[10px] font-bold text-amber-800">{isAr?'مداخيل':'Revenu'}</div><div className="text-sm font-black text-amber-900 font-mono">{r2(tot.rev).toLocaleString()} دج</div></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-neutral-700 mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />{isAr?'خط بياني - الوارد والصادر':'Courbe - Entree et Sortie'}</h3>
              <svg viewBox="0 0 400 150" className="w-full h-32">
                {(()=>{const me=months.slice(0,12).map(m=>rows.filter(r=>r.month===m).reduce((a,r)=>a+r.e,0));const ms=months.slice(0,12).map(m=>rows.filter(r=>r.month===m).reduce((a,r)=>a+r.s,0));const max=Math.max(1,...me,...ms);const n=Math.max(1,me.length-1);const ptsE=me.map((v,i)=>`${(i/n)*390+5},${140-(v/max)*130}`).join(' ');const ptsS=ms.map((v,i)=>`${(i/n)*390+5},${140-(v/max)*130}`).join(' ');return <><polyline points={ptsE} fill="none" stroke="#16a34a" strokeWidth="3"/><polyline points={ptsS} fill="none" stroke="#2563eb" strokeWidth="3"/></>;})()}
              </svg>
              <div className="flex gap-3 text-[10px] font-bold"><span className="text-emerald-700">■ {isAr?'وارد':'Entree'}</span><span className="text-blue-700">■ {isAr?'صادر':'Sortie'}</span></div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-neutral-700 mb-2">{isAr?'دائرة - توزيع المخزون':'Cercle - Repartition stock'}</h3>
              <svg viewBox="0 0 120 120" className="w-32 h-32 mx-auto">
                {(()=>{const total=tot.e+tot.s||1;const pe=(tot.e/total)*100;const ps=(tot.s/total)*100;return <><circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="16"/><circle cx="60" cy="60" r="45" fill="none" stroke="#16a34a" strokeWidth="16" strokeDasharray={`${pe*2.827} 282.7`} transform="rotate(-90 60 60)"/><circle cx="60" cy="60" r="45" fill="none" stroke="#2563eb" strokeWidth="16" strokeDasharray={`${ps*2.827} 282.7`} strokeDashoffset={-pe*2.827} transform="rotate(-90 60 60)"/></>;})()}
              </svg>
              <div className="flex justify-center gap-3 text-[10px] font-bold"><span className="text-emerald-700">{fmt(tot.e)} {isAr?'وارد':'E'}</span><span className="text-blue-700">{fmt(tot.s)} {isAr?'صادر':'S'}</span></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            </table>
          </div>
        </div>
        <div className="text-xs text-neutral-500 text-center flex items-center justify-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />{isAr?"المداخيل موزعة تناسبيا حسب كمية كل منتج في كل عملية بيع.":"Revenus repartis proportionnellement a la quantite de chaque produit par vente."}</div>
      </main>
    </div>
  );
}
