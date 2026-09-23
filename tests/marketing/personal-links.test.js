import test from 'node:test'
import assert from 'node:assert/strict'
import { newPersonalLink, linkHash, validatePersonalBindings, personalLinksEnabled, previousContact, contactPreview, installPersonalLinks } from '../../server/marketing/personal-links.js'
import { renderTemplate } from '../../server/marketing/domain.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const cfg = { env: {
 PERSONAL_LINKS_ENABLED:'true', PERSONAL_LANDING_URL:'https://cosmos-algerie.com/products/عرض',
 PERSONAL_SHOPIFY_SHOP:'example.myshopify.com', PERSONAL_SHOPIFY_CLIENT_ID:'fixture-id',
 PERSONAL_SHOPIFY_CLIENT_SECRET:'fixture-secret', PERSONAL_ORDER_WEBHOOK_URL:'https://example.test/orders',
} }
const template = { name:'offre', language:'ar', components:[
 {type:'BODY',text:'Ya {{1}}'}, {type:'BUTTONS',buttons:[{type:'URL',text:'Commander',url:cfg.env.PERSONAL_LANDING_URL+'?access={{1}}'}]},
] }
const bindings = {'BODY.1':{source:'firstName'},'BUTTON.0':{source:'personalLink'}}

test('unique opaque links and separate body/button values',()=>{
 const a=newPersonalLink(),b=newPersonalLink()
 assert.match(a.token,/^[A-Za-z0-9_-]{43}$/); assert.notEqual(a.token,b.token)
 assert.equal(a.hash,linkHash(a.token)); assert.notEqual(a.requestId,b.requestId)
 assert.equal(validatePersonalBindings(template,bindings,cfg),true)
 const payload=renderTemplate(template,bindings,{name:'Amine Test',phone:'+213555000001',purchases:[],personalLink:a.token})
 assert.equal(payload.components[0].parameters[0].text,'Amine')
 assert.equal(payload.components[1].parameters[0].text,a.token)
 assert.throws(()=>renderTemplate(template,{'BODY.1':{source:'personalLink'}},{name:'Test',purchases:[],personalLink:a.token}))
})
test('configuration fails closed, preview cannot order, encoded URL is equivalent',()=>{
 assert.equal(personalLinksEnabled({env:{}}),false)
 assert.equal(personalLinksEnabled({env:{...cfg.env,VERCEL:'1',VERCEL_ENV:'preview'}}),false)
 assert.throws(()=>validatePersonalBindings(template,bindings,{env:{}}))
 assert.throws(()=>validatePersonalBindings(template,{'BODY.1':{source:'personalLink'}},cfg))
 const encoded=structuredClone(template);encoded.components[1].buttons[0].url=new URL(encoded.components[1].buttons[0].url).href
 assert.equal(validatePersonalBindings(encoded,bindings,cfg),true)
 encoded.components[1].buttons[0].url='https://wrong.example/?access={{1}}'
 assert.throws(()=>validatePersonalBindings(encoded,bindings,cfg))
})
const phone='+213555000001'
const address={firstName:'Amine',lastName:'Test',phone,address1:'Rue exemple 12',city:'16 - Algiers الجزائر'}
function shopFetch(orders){let call=0;return async(_url,options)=>{
 call++
 if(call===1)return {ok:true,json:async()=>({access_token:'fixture-token'})}
 const query=JSON.parse(options.body).variables.q
 assert.ok(!query.includes('phone:'));assert.ok(query.includes('0555000001'))
 return {ok:true,json:async()=>({data:{orders:{nodes:orders}}})}
}}
test('exact delivery phone, complete address, and supported wilaya required',async()=>{
 const order={id:'gid://shopify/Order/1',phone,shippingAddress:address}
 const contact=await previousContact(phone,cfg,shopFetch([order]))
 assert.equal(contact.name,'Amine Test');assert.deepEqual(contactPreview(contact),{phoneEnding:'0001',phone,wilaya:address.city,address:'Rue exemple 12'})
 for(const shippingAddress of [{...address,phone:'+213555000002'},{...address,address1:''},{...address,city:'Unknown'}])
  assert.equal(await previousContact(phone,cfg,shopFetch([{...order,shippingAddress},order])),null)
 assert.equal(await previousContact(phone,cfg,shopFetch([{...order,phone:'+213555000002',shippingAddress:{...address,phone:'+213555000002'}}])),null)
})
function harness(fetcher){
 const routes={},link=newPersonalLink()
 const row={token_hash:link.hash,request_id:link.requestId,phone,contact:{name:'Amine Test',phone,address:'Rue exemple 12',wilaya:address.city},state:'ready'}
 const db={query:async(sql,params)=>{
  if(sql.includes('views=views+1'))return {rows:params[0]===link.hash?[{...row}]:[]}
  if(sql.includes("SET state='processing'")){
   if(row.state!=='ready')return {rowCount:0,rows:[]}
   row.state='processing';return {rowCount:1,rows:[{request_id:row.request_id}]}
  }
  if(sql.includes('SET state=$2')){row.state=params[1];row.result=params[2];return {rowCount:1,rows:[]}}
  throw Error('Unexpected SQL')
 }}
 const app={use:()=>{},post:(p,handler)=>{routes[p]=handler}}
 installPersonalLinks(app,db,cfg,fetcher)
 const call=async(action,body={})=>{
  let status=200,output
  const res={status(v){status=v;return this},json(v){output=v;return this}}
  await routes['/api/marketing/personal/'+action]({body:{token:link.token,...body}},res)
  return {status,output}
 }
 return {call,row}
}
test('opening a personal link returns delivery details but never creates an order',async()=>{
 const h=harness(()=>{throw Error('must not send')})
 const result=await h.call('preview')
 assert.deepEqual(result.output,{state:'ready',phoneEnding:'0001',phone,wilaya:address.city,address:'Rue exemple 12'})
 assert.equal(h.row.state,'ready')
})
test('concurrent clicks create one order using server contact and stable request ID',async()=>{
 let sends=0
 const h=harness(async(_url,options)=>{
  sends++;const data=JSON.parse(options.body)
  assert.equal(data.phone,phone);assert.equal(data.name,'Amine Test');assert.equal(data.requestId,h.row.request_id)
  return {ok:true,status:200,json:async()=>({ok:true,orderName:'#test',total:3900})}
 })
 await Promise.all([h.call('confirm',{model:'p20',delivery:'home',phone:'ATTACK'}),h.call('confirm',{model:'p20',delivery:'home'})])
 assert.equal(sends,1);assert.equal(h.row.state,'created')
 assert.equal((await h.call('confirm',{model:'p20',delivery:'home'})).output.orderName,'#test')
 assert.equal(sends,1)
})
test('uncertain network result stays blocked and cannot silently resubmit',async()=>{
 let sends=0
 const h=harness(async()=>{sends++;throw Error('timeout')})
 assert.equal((await h.call('confirm',{model:'p44n',delivery:'stop_desk'})).status,202)
 await h.call('confirm',{model:'p44n',delivery:'stop_desk'})
 assert.equal(h.row.state,'review');assert.equal(sends,1)
})
test('complete Liquid artifact has valid JavaScript after Shopify substitutions',()=>{
 const html=readFileSync(new URL('../../docs/cosmos-40/product.cosmos-40-dz.liquid',import.meta.url),'utf8')
 assert.ok(html.startsWith('{% layout none %}'))
 const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1])
 assert.ok(scripts.length>=3)
 for(const script of scripts){
  const rendered=script.replace(/{%[\s\S]*?%}/g,'').replace(/{{[\s\S]*?}}/g,'null')
  new vm.Script(rendered)
 }
 assert.ok(html.includes('if(personalMode){await submitPersonalOrder();return;}'))
 assert.ok(html.includes("addressConfirmation.querySelector('input').required=true"))
})
