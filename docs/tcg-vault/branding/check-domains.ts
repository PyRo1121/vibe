import { readFileSync } from 'node:fs';

const accountId = 'f1e95b3e1b502cf366dfc81a863695fa';
const config = readFileSync(
	`${process.env.APPDATA ?? process.env.HOME}/xdg.config/.wrangler/config/default.toml`,
	'utf8'
);
const token = config.match(/^oauth_token = "(.+)"$/m)?.[1];
if (!token) throw new Error('No wrangler oauth token');

const candidates = [
	'pullrack.com',
	'setrack.com',
	'bindrack.com',
	'holorack.com',
	'deckrack.com',
	'pullledger.com',
	'setledger.com',
	'cardledger.com',
	'hololedger.com',
	'deckledger.com',
	'bindledger.com',
	'pullscout.com',
	'setscout.com',
	'cardscout.com',
	'holoscout.com',
	'deckscout.com',
	'bindscout.com',
	'pullstash.com',
	'setstash.com',
	'cardstash.com',
	'holostash.com',
	'deckstash.com',
	'bindstash.com',
	'bindfolio.com',
	'holofolio.com',
	'deckfolio.com',
	'pullworth.com',
	'setworth.com',
	'deckworth.com',
	'bindworth.com',
	'holoworth.com',
	'slabstash.com',
	'slabscout.com',
	'packstash.com',
	'packscout.com',
	'packledger.com',
	'foilstash.com',
	'foilscout.com',
	'holopull.com',
	'deckpull.com',
	'setpull.com',
	'bindpull.com',
	'pullbind.com',
	'setbind.com',
	'deckbind.com',
	'bindbase.com',
	'pullbase.com',
	'setbase.com',
	'holobase.com',
	'deckbase.com',
	'tcgledger.com',
	'tcgscout.com',
	'tcgstash.com',
	'tcgpulse.com',
	'pullbox.com',
	'setbox.com',
	'holobox.com',
	'cardcrate.com',
	'deckcrate.com',
	'pullcrate.com',
	'setcrate.com',
	'bindcrate.com',
	'bindly.com',
	'pullly.com',
	'setly.com',
	'hololy.com',
	'deckly.com',
	'bindlist.com',
	'hololist.com',
	'setlisthq.com',
	'pullchart.com',
	'setchart.com',
	'cardchart.com',
	'holochart.com',
	'pricebinder.com',
	'bindprice.com',
	'setpricehq.com',
	'pullprice.com',
	'fullbinder.com',
	'everyset.com',
	'setcomplete.com',
	'cardcomplete.com',
	'playsethq.com',
	'completionhq.com',
	'rarityrack.com',
	'raritystash.com',
	'packworth.com',
	'slabworth.com',
	'foilworth.com',
	'holoindex.com',
	'setindexer.com',
	'cardindexer.com',
	'pullindexer.com',
	'bindindex.com',
	'setmapper.com',
	'cardmapper.com',
	'pullmapper.com',
	'deckmapper.com',
	'holomapper.com',
	'bindmapper.com',
	'slabmapper.com',
	'packmapper.com',
	'foilmapper.com',
	'raritymap.com',
	'setwatch.com',
	'cardwatchtcg.com',
	'pullwatch.com',
	'holoatlas.com',
	'deckatlas.com',
	'bindatlas.com',
	'setatlas.com',
	'pullatlas.com',
	'cardatlasio.com',
	'getsetly.com',
	'usepullr.com',
	'openbindr.com',
	'trysetly.com',
	'mysetstash.com',
	'ourpulllist.com',
	'thesetstash.com',
	'gotpull.com',
	'gotsets.com',
	'gotbind.com',
	'gotfoil.com',
	'got holo.com'.replace(' ', ''),
	'gotholo.com',
	'ripstash.com',
	'ripscout.com',
	'rippull.com',
	'ripsets.com',
	'packrip.com',
	'slabrip.com',
	'bindrip.com',
	'setrip.com',
	'cardrip.com',
	'deckrip.com',
	'holodex.com',
	'setdex.com',
	'pulldex.com',
	'binddex.com',
	'deckdex.com',
	'carddex.com',
	'slabdex.com',
	'packdex.com',
	'foildex.com',
	'raritydex.com',
	'checklistdex.com',
	'setchecklist.com',
	'cardchecklist.com',
	'pullchecklist.com',
	'deckchecklist.com',
	'holochecklist.com',
	'bindchecklist.com'
];

const chunks: string[][] = [];
for (let i = 0; i < candidates.length; i += 20) {
	chunks.push(candidates.slice(i, i + 20));
}

const available: {
	name: string;
	registration_cost?: string;
	renewal_cost?: string;
	currency?: string;
}[] = [];

for (const domains of chunks) {
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/registrar/domain-check`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ domains })
		}
	);
	const json = (await res.json()) as {
		success: boolean;
		result?: {
			domains: {
				name: string;
				registrable: boolean;
				reason?: string;
				pricing?: { registration_cost: string; renewal_cost: string; currency: string };
			}[];
		};
		errors?: unknown;
	};
	if (!json.success) {
		console.error('API error', json.errors);
		process.exit(1);
	}
	for (const d of json.result?.domains ?? []) {
		if (d.registrable) {
			available.push({
				name: d.name,
				registration_cost: d.pricing?.registration_cost,
				renewal_cost: d.pricing?.renewal_cost,
				currency: d.pricing?.currency
			});
		}
	}
}

available.sort((a, b) => a.name.localeCompare(b.name));
console.log(JSON.stringify(available, null, 2));
console.error(`Checked ${candidates.length} domains, ${available.length} available`);
