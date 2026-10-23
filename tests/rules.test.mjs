// Firestore ルールのテスト（エミュレータで実行）。npm test から呼ばれます。
import {setLogLevel} from 'firebase/firestore';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {readFileSync} from 'fs';
import {fileURLToPath} from 'url';
const RULES=fileURLToPath(new URL('../firestore.rules',import.meta.url));
// 作成者のメールアドレスは、ルールの owners() から読む
const OWNER=readFileSync(RULES,'utf8').match(/function owners\(\) \{ return \['([^']+)'/)[1];
import {doc,setDoc,getDoc,deleteDoc,writeBatch,serverTimestamp,updateDoc} from 'firebase/firestore';
setLogLevel('silent');
const env=await initializeTestEnvironment({projectId:'demo-genka',firestore:{rules:readFileSync(RULES,'utf8'),host:'127.0.0.1',port:8080}});
await env.clearFirestore();
const g=(id,email)=>env.authenticatedContext(id,{email:email||id+'@x.com',email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const anon=id=>env.authenticatedContext(id,{firebase:{sign_in_provider:'anonymous'}}).firestore();
const owner=env.authenticatedContext('own',{email:OWNER,email_verified:true,firebase:{sign_in_provider:'google.com'}}).firestore();
const out=env.unauthenticatedContext().firestore();
let pass=0,fail=0;
// t(説明, 書き込み, true=通るべき / false=止まるべき)
async function t(name,p,ok){try{await (ok?assertSucceeds(p):assertFails(p));pass++;}catch(e){fail++;console.log('NG:',name,'—',ok?'通るはずが止まった':'止まるはずが通った');}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const jst=()=>Math.floor((Date.now()+324e5)/864e5);
function rated(db,uid,fill){const b=writeBatch(db);b.set(doc(db,'rate/'+uid),{t:serverTimestamp()});fill(b);return b.commit();}
const pub=(uid,wid,extra={})=>({owner:uid,wid,name:'ピアス',note:'',price:1200,hasPhoto:false,pv:1,publishedAt:1,t:serverTimestamp(),...extra});
const A=anon('alice'),B=anon('bob'),C=g('carol'),D=g('dave');
// publish
await t('anon publish own work',rated(A,'alice',b=>b.set(doc(A,'pub/alice__w1'),pub('alice','w1'))),true);
await t('publish without rate',setDoc(doc(B,'pub/bob__w1'),pub('bob','w1')),false);
await t('publish as someone else',rated(B,'bob',b=>b.set(doc(B,'pub/alice__w9'),pub('alice','w9'))),false);
await t('publish id mismatch',rated(B,'bob',b=>b.set(doc(B,'pub/bob__x'),pub('bob','w1'))),false);
await sleep(5200);
await t('publish too long name',rated(B,'bob',b=>b.set(doc(B,'pub/bob__w1'),pub('bob','w1',{name:'あ'.repeat(61)}))),false);
await t('publish extra field',rated(B,'bob',b=>b.set(doc(B,'pub/bob__w1'),pub('bob','w1',{evil:1}))),false);
await t('publish negative price',rated(B,'bob',b=>b.set(doc(B,'pub/bob__w1'),pub('bob','w1',{price:-5}))),false);
await t('photo not jpeg',rated(B,'bob',b=>{b.set(doc(B,'pub/bob__w1'),pub('bob','w1'));b.set(doc(B,'pubph/bob__w1'),{owner:'bob',photo:'data:text/html;base64,PHNjcmlwdD4='});}),false);
await t('bob publish ok with photo',rated(B,'bob',b=>{b.set(doc(B,'pub/bob__w1'),pub('bob','w1',{hasPhoto:true}));b.set(doc(B,'pubph/bob__w1'),{owner:'bob',photo:'data:image/jpeg;base64,'+'A'.repeat(100)});}),true);
await t('second publish within 5s',rated(B,'bob',b=>b.set(doc(B,'pub/bob__w2'),pub('bob','w2'))),false);
await t('fake rate time',setDoc(doc(B,'rate/bob'),{t:new Date(0)}),false);
await t('delete others work',deleteDoc(doc(B,'pub/alice__w1')),false);
await t('signed out write',setDoc(doc(out,'pub/x__w'),pub('x','w')),false);
await t('signed out read pub',getDoc(doc(out,'pub/alice__w1')),true);
// comments
await sleep(5200);
const cm=(uid,extra={})=>({uid,workId:'alice:w1',text:'すてき',at:1,t:serverTimestamp(),...extra});
await t('comment without rate',setDoc(doc(B,'cmts/c0'),cm('bob')),false);
await t('comment ok',rated(B,'bob',b=>b.set(doc(B,'cmts/c1'),cm('bob'))),true);
await t('comment spam within 5s',rated(B,'bob',b=>b.set(doc(B,'cmts/c2'),cm('bob'))),false);
await sleep(5200);
await t('comment 301 chars',rated(B,'bob',b=>b.set(doc(B,'cmts/c3'),cm('bob',{text:'あ'.repeat(301)}))),false);
await t('comment on missing work',rated(B,'bob',b=>b.set(doc(B,'cmts/c4'),cm('bob',{workId:'nobody:zz'}))),false);
await t('comment as someone else',rated(B,'bob',b=>b.set(doc(B,'cmts/c5'),cm('alice'))),false);
await t('edit comment',updateDoc(doc(B,'cmts/c1'),{text:'x'}),false);
await t('delete others comment',deleteDoc(doc(A,'cmts/c1')),false);
await t('owner deletes comment',deleteDoc(doc(owner,'cmts/c1')),true);
// likes
const rec=(o={})=>({works:{},supers:{},superAt:{},day:'d',used:0,extra:0,g:true,dn:jst(),t:serverTimestamp(),...o});
await t('anon like',setDoc(doc(A,'likes/alice'),rec({works:{'bob:w1':1}})),false);
await t('google like',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1}})),true);
await sleep(1100);
await t('like 2 works at once',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1,'bob:w1':1,'x:y':1}})),false);
await t('like for someone else',setDoc(doc(C,'likes/dave'),rec()),false);
await t('super +2',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':2},used:1,lastSup:'alice:w1'})),false);
await t('super with extra=5',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1},used:1,extra:5,lastSup:'alice:w1'})),false);
await t('super own work',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'carol:w1':1},used:1,lastSup:'carol:w1'})),false);
await t('super without used++',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1},used:0,lastSup:'alice:w1'})),false);
await t('super ok',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1},superAt:{'alice:w1':1},used:1,lastSup:'alice:w1'})),true);
await sleep(1100);
await t('2nd super same day',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1,'bob:w1':1},used:2,lastSup:'bob:w1'})),false);
await t('reset used same day',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1,'bob:w1':1},used:1,lastSup:'bob:w1'})),false);
await t('fake day',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1,'bob:w1':1},used:1,dn:jst()+1,lastSup:'bob:w1'})),false);
await t('unlike ok',setDoc(doc(C,'likes/carol'),rec({works:{},supers:{'alice:w1':1},superAt:{'alice:w1':1},used:1,lastSup:'alice:w1'})),true);
await t('like spam <1s',setDoc(doc(C,'likes/carol'),rec({works:{'alice:w1':1},supers:{'alice:w1':1},superAt:{'alice:w1':1},used:1,lastSup:'alice:w1'})),false);
// profiles / reports / mod / private data
await t('profile ok',setDoc(doc(A,'profiles/alice'),{name:'アリス',t:serverTimestamp()}),true);
await t('profile too long',setDoc(doc(B,'profiles/bob'),{name:'x'.repeat(31),t:serverTimestamp()}),false);
await t('profile of other',setDoc(doc(B,'profiles/alice'),{name:'偽',t:serverTimestamp()}),false);
await t('report ok',setDoc(doc(B,'reports/bob'),{items:{'alice:c1':true},t:serverTimestamp()}),true);
await t('mod by non-owner',setDoc(doc(C,'mod/settings'),{words:[],ai:true,threshold:3,blocked:{},cleared:{}}),false);
await t('mod unverified owner email',setDoc(doc(env.authenticatedContext('x',{email:OWNER,email_verified:false}).firestore(),'mod/settings'),{words:[],ai:true,threshold:3,blocked:{},cleared:{}}),false);
await t('owner check readable by owner',getDoc(doc(owner,'mod/ownercheck')),true);
await t('owner check hidden from others',getDoc(doc(C,'mod/ownercheck')),false);
await t('owner check hidden from guests',getDoc(doc(A,'mod/ownercheck')),false);
await t('mod by owner (block bob)',setDoc(doc(owner,'mod/settings'),{words:[],ai:true,threshold:3,blocked:{bob:true},cleared:{}}),true);
await sleep(5200);
await t('blocked bob comments',rated(B,'bob',b=>b.set(doc(B,'cmts/c9'),cm('bob'))),false);
await t('blocked bob publishes',rated(B,'bob',b=>b.set(doc(B,'pub/bob__w3'),pub('bob','w3'))),false);
await t('blocked bob renames',setDoc(doc(B,'profiles/bob'),{name:'b',t:serverTimestamp()}),false);
await t('own ledger write',setDoc(doc(A,'data/users/alice/p1'),{kind:'part',name:'ビーズ',price:480,qty:100,unit:'個',createdAt:1,updatedAt:1}),true);
await t('read others ledger',getDoc(doc(B,'data/users/alice/p1')),false);
await t('owner reads others ledger',getDoc(doc(owner,'data/users/alice/p1')),false);
await t('ledger bad kind',setDoc(doc(A,'data/users/alice/p2'),{kind:'evil'}),false);
await t('random collection',setDoc(doc(A,'hack/x'),{a:1}),false);
await t('read rate of other',getDoc(doc(A,'rate/bob')),false);
console.log('ルールのテスト: 成功',pass,'件 / 失敗',fail,'件');await env.cleanup();if(fail)process.exit(1);
