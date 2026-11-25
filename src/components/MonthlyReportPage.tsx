import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Package, RefreshCw, TrendingUp } from 'lucide-react';
import { readInventory } from '../services/googleSheetsApi';
import { EntreeItem, SortieItem } from '../types/stock';

type Lang = 'ar' | 'fr';

const PRODUCT_KEYS = ['qty152Vert','qty152Bleu','qty152Noir','qty152KS','qty152KF','qty152Gris','qty124Vert','qty124Bleu'] as const;
const PRODUCT_LABELS: Record<string,string> = { qty152Vert:'152 Vert', qty152Bleu:'152 Bleu', qty152Noir:'152 Noir', qty152KS:'152 K.S', qty152KF:'152 K.F', qty152Gris:'152 Gris', qty124Vert:'124 Vert', qty124Bleu:'124 Bleu' };

function round2(v:number){return Math.round((v||0)*100)/100;}
function fmt(v:number){const r=round2(v);return r===0?'0.00':r.toFixed(2);}
function monthOf(d:string){return (d||'').slice(0,7);}
function monthLabel(m:string,lang:Lang){
  if(!m) return '';
  const [y,mm]=m.split('-');
  const ar=['ظٹظ†ط§ظٹط±','ظپط¨ط±ط§ظٹط±','ظ…ط§ط±ط³','ط£ط¨ط±ظٹظ„','ظ…ط§ظٹظˆ','ظٹظˆظ†ظٹظˆ','ظٹظˆظ„ظٹظˆ','ط£ط؛ط³ط·ط³','ط³ط¨طھظ…ط¨ط±','ط£ظƒطھظˆط¨ط±','ظ†ظˆظپظ…ط¨ط±','ط¯ظٹط³ظ…ط¨ط±'];
  const fr=['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const names=lang==='ar'?ar:fr;
  const idx=parseInt(mm,10)-1; return `${names[idx]??mm} ${y}`;
}
interface MonthRow{month:string;productKey:string;productLabel:string;entree:number;sortie:number;balance:number;revenue:number;salesCount:number;}

export default function MonthlyReportPage(){
  const [lang,setLang]=useState<Lang>('ar');
  const [entrees,setEntrees]=useState<EntreeItem[]>([]);
  const [sorties,setSorties]=useState<SortieItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [selectedProduct,setSelectedProduct]=useState<string>('all');
  const [selectedMonth,setSelectedMonth]=useState<string>('all');
  const isAr=lang==='ar';
  const load=async()=>{setLoading(true);setError(null);try{const data=await readInventory();setEntrees(Array.isArray(data.entrees)?data.entrees:[]);setSorties(Array.isArray(data.sorties)?data.sorties:[]);}catch(e:any){setError(e?.message||(isAr?'طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„ط¨ظٹط§ظ†ط§طھ':'Impossible de charger les donnأ©es'));}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const months=useMemo(()=>{const set=new Set<string>();entrees.forEach(e=>set.add(monthOf(e.date)));sorties.forEach(s=>set.add(monthOf(s.date)));return Array.from(set).filter(Boolean).sort().reverse();},[entrees,sorties]);
  const rows:MonthRow[]=useMemo(()=>{
    const map=new Map<string,MonthRow>();const key=(m:string,p:string)=>`${m}|${p}`;
    for(const p of PRODUCT_KEYS) for(const m of months) map.set(key(m,p),{month:m,productKey:p,productLabel:PRODUCT_LABELS[p],entree:0,sortie:0,balance:0,revenue:0,salesCount:0});
    entrees.forEach(e=>{const m=monthOf(e.date);for(const p of PRODUCT_KEYS){const q=Number((e as any)[p])||0;if(q<=0)continue;const r=map.get(key(m,p));if(r){r.entree+=q;r.balance+=q;}}});
    sorties.forEach(s=>{const m=monthOf(s.date);for(const p of PRODUCT_KEYS){const q=Number((s as any)[p])||0;if(q<=0)continue;const r=map.get(key(m,p));if(r){r.sortie+=q;r.balance-=q;r.salesCount+=1;}}});
    const revenueMap=new Map<string,number>();
    sorties.forEach(s=>{const m=monthOf(s.date);const saleQty=PRODUCT_KEYS.reduce((a,p)=>a+(Number((s as any)[p])||0),0);const montant=Number(s.montant)||0;for(const p of PRODUCT_KEYS){const q=Number((s as any)[p])||0;if(q<=0||saleQty<=0)continue;const share=montant*(q/saleQty);const k=key(m,p);revenueMap.set(k,(revenueMap.get(k)||0)+share);}});
    revenueMap.forEach((v,k)=>{const r=map.get(k);if(r)r.revenue=v;});
    let result=Array.from(map.values()).filter(r=>r.entree>0||r.sortie>0);
    if(selectedProduct!=='all') result=result.filter(r=>r.productKey===selectedProduct);
    if(selectedMonth!=='all') result=result.filter(r=>r.month===selectedMonth);
    result.sort((a,b)=>b.month.localeCompare(a.month)||a.productLabel.localeCompare(b.productLabel));
    return result;
  },[entrees,sorties,months,selectedProduct,selectedMonth]);
  const totals=useMemo(()=>{const t={entree:0,sortie:0,revenue:0};rows.forEach(r=>{t.entree+=r.entree;t.sortie+=r.sortie;t.revenue+=r.revenue;});return t;},[rows]);
  const exportCSV=()=>{
    const header=isAr?['ط§ظ„ط´ظ‡ط±','ط§ظ„ظ…ظ†طھط¬','ظˆط§ط±ط¯ (ظ…)','طµط§ط¯ط± (ظ…)','ط§ظ„ط±طµظٹط¯ (ظ…)','ط§ظ„ظ…ط¯ط§ط®ظٹظ„ (ط¯ط¬)']:['Mois','Produit','Entree (m)','Sortie (m)','Solde (m)','Revenu (DZD)'];
    const lines=[header.join(',')];
    rows.forEach(r=>{lines.push([monthLabel(r.month,lang),r.productLabel,fmt(r.entree),fmt(r.sortie),fmt(r.balance),round2(r.revenue).toFixed(2)].join(','));});
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`rapport-mensuel-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  };
  return (<div />);
}
