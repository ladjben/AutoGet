// Opt-in deployment check. Reads Shopify only, prints no credentials or customer data.
if (process.env.COSMOS_VERIFY_SHOPIFY === '1') {
 try {
  const shop=process.env.PERSONAL_SHOPIFY_SHOP
  if(!/^[a-z0-9-]+\.myshopify\.com$/.test(shop||''))throw Error('SHOP_CONFIG')
  const r=await fetch(`https://${shop}/admin/oauth/access_token`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:process.env.PERSONAL_SHOPIFY_CLIENT_ID||'',client_secret:process.env.PERSONAL_SHOPIFY_CLIENT_SECRET||''})})
  const t=await r.json()
  if(!r.ok||!t.access_token)throw Error('SHOP_AUTH')
  const q=await fetch(`https://${shop}/admin/api/2026-07/graphql.json`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-Shopify-Access-Token':t.access_token},body:JSON.stringify({query:'{ orders(first:1,sortKey:CREATED_AT,reverse:true) { nodes { id shippingAddress { firstName lastName phone address1 city } } } }'})})
  const data=await q.json()
  if(!q.ok||data.errors?.length)throw Error('SHOP_ORDER_READ')
  console.log('COSMOS_SHOPIFY_AUTH_AND_ORDER_ADDRESS_READ_OK')
 } catch(e) {
  console.log('COSMOS_SHOPIFY_CHECK_FAILED', ['SHOP_CONFIG','SHOP_AUTH','SHOP_ORDER_READ'].includes(e.message)?e.message:'NETWORK_OR_RESPONSE')
  process.exitCode=1
 }
}
