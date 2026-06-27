import { ApiPromise, WsProvider } from "@polkadot/api";
const api = await ApiPromise.create({ provider: new WsProvider("wss://rpc.alpha-testnet.theseus.network",3000), throwOnConnect:true });
const A:any = { Cyril:"5D3WpRBFauVa7eTDGVAsPi25JAPRc8uy2AhrbqX8dS1iDxeD", Emir:"5GpgHt6LcAKcQz1K2x1P4wg6VmcwG8Ya96b5H5JCfpYTWDV4", Faye:"5C6QN25yd8wNHSfEsMiyyLhzCBHE1qyqK1tvdQg9KJnxUj43", Hana:"5DEJZX88K9oB7YvsGYWrcr1pibn9erQ1eVicUqnBVVGLeizW" };
for (const [seat,addr] of Object.entries(A)){ try{ const seq=await (api.query.agents as any).nextRunSeq(addr); const inc=await (api.query.agents as any).incompleteRuns(addr); console.log(seat, "nextSeq", seq.toString(), "incomplete", JSON.stringify(inc.toJSON()).slice(0,60)); }catch(e:any){ console.log(seat,"err",e.message?.slice(0,40)); } }
await api.disconnect();
