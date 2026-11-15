// What is interesting in the food, beyond the numbers: characteristic compounds worth knowing
// about, and cautions worth knowing about. Curated here so it works offline and without an AI
// key; the AI can add to it but never replaces it.
//
// Ground rules for every entry, so this stays trustworthy rather than wellness-blog filler:
//  - name the compound and the food, and say what is actually established, hedged honestly
//  - no claims that a food treats, prevents or cures anything
//  - a caution says who it applies to, since most apply to some people and not others
// None of it is medical advice, and the app says so where this is shown.

const E = []
const g = (label, re, text) => { E.push({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), t: 'good', label, re, text }) }
const c = (label, re, text) => { E.push({ id: 'c-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), t: 'caution', label, re, text }) }

// ─── compounds worth knowing about ──────────────────────────────────────────────
g('Beta-glucans', /\boats?\b|oatmeal|rolled oats|steel.?cut|oat flour|\bbarley\b/i,
  'Soluble fiber that turns gel-like in the gut. Around 3 g a day is the amount tied to a modest drop in LDL cholesterol — roughly a cup and a half of cooked oats.')
g('Avenanthramides', /\boats?\b|oatmeal|rolled oats/i,
  'Polyphenols more or less unique to oats. Studied mostly for anti-inflammatory effects in the lab; what they do in people eating normal amounts is still open.')
g('Sulforaphane', /broccoli|cauliflower|\bkale\b|brussels? sprout|\bcabbage\b|bok choy|collard|arugula|rocket|watercress|kohlrabi|\bradish|\bturnip|mustard greens|broccoli sprout/i,
  'Formed when you chop or chew brassicas and an enzyme meets the glucosinolates. Heat destroys the enzyme, so a few minutes of steaming keeps far more of it than long boiling.')
g('Nitrates', /\bbeets?\b|beetroot|\barugula\b|\brocket\b|\bspinach\b|swiss chard|\bcelery\b|\blettuce\b/i,
  'Dietary nitrate, which the body converts to nitrite and then nitric oxide — the basis of the beet-juice blood-pressure and endurance research. Worth saying: nitrate from vegetables behaves differently from nitrite added to cured meat.')
g('Betalains', /\bbeets?\b|beetroot|prickly pear/i,
  'The deep red-purple pigments in beets, antioxidant in the lab. They are also why beets can turn urine or stool pink, which is harmless.')
g('Quercetin', /\bonions?\b|\bshallots?\b|\bapples?\b(?!\s*(cider|juice))|\bcapers\b|red onion/i,
  'A flavonoid concentrated in onion skin and the outer layers, and in apple peel. Supplement-sized doses show small blood-pressure effects; food amounts are much lower.')
g('Pectin', /\bapples?\b(?!\s*cider)|\bpears?\b|citrus peel|\bquince\b/i,
  'The soluble fiber that makes jam set. It also binds water in the gut, which is why apple is a standard suggestion for both loose and sluggish digestion.')
g('Lycopene', /\btomato(es)?\b|passata|tomato paste|marinara|tomato sauce|watermelon|pink grapefruit|\bguava\b/i,
  'A carotenoid you absorb better from cooked tomato with some fat than from raw — tomato paste is the densest source in an ordinary kitchen.')
g('Anthocyanins', /blueberr|blackberr|raspberr|strawberr|cranberr|bilberr|elderberr|a[çc]a[íi]|black currant|purple cabbage|red cabbage|purple sweet potato|black ric|concord grape/i,
  'The blue-purple-red pigments in berries and purple vegetables. The better human evidence is for blood-vessel function and blood pressure, at roughly a cup of berries a day.')
g('Omega-3 (EPA and DHA)', /\bsalmon\b|\bsardines?\b|\bmackerel\b|\banchov|\bherring\b|\btrout\b|\bcaviar\b|\broe\b|\boysters?\b/i,
  'The long-chain omega-3s, the form your body can use directly. Two servings of oily fish a week is the common public-health target.')
g('Omega-3 (ALA)', /\bwalnuts?\b|flax\s?seed|flaxseed|ground flax|\bchia\b|hemp (seed|heart)|canola oil/i,
  'The plant form. Your body converts only a few percent of it to EPA and DHA, so it is not a straight swap for oily fish, though the foods themselves are excellent.')
g('Astaxanthin', /\bsalmon\b|\bshrimp\b|\bprawns?\b|\bkrill\b|\btrout\b|\blobster\b/i,
  'The carotenoid that makes salmon and cooked shellfish pink. A strong antioxidant in the lab; human evidence is mostly supplement studies.')
g('Lutein and zeaxanthin', /\bkale\b|\bspinach\b|collard|swiss chard|\beggs?\b|\bcorn\b|\bpeas\b|\bpistachio|\bparsley\b|turnip greens/i,
  'Carotenoids that concentrate in the retina. The AREDS2 trial used them for age-related macular degeneration; egg yolk is a small but unusually well-absorbed source.')
g('Choline', /\beggs?\b|\bliver\b|\bsoybeans?\b|wheat germ|\bcod\b|chicken breast|\bquinoa\b/i,
  'Needed for cell membranes and acetylcholine, and genuinely hard to get enough of. Two eggs is roughly half a day’s worth.')
g('Allicin', /\bgarlic\b/i,
  'Formed when garlic is crushed or chopped, not before. It breaks down with heat, so letting chopped garlic stand about ten minutes before cooking preserves more of it.')
g('Fructans (prebiotic)', /\bgarlic\b|\bonions?\b|\bleeks?\b|\basparagus\b|jerusalem artichoke|sunchoke|\bchicory\b|\bendive\b|dandelion green|\bwheat\b/i,
  'Fiber your gut bacteria ferment rather than you digesting it. Good for the microbiome, and the usual culprit when these foods cause bloating — they are the F in FODMAP.')
g('Inulin', /jerusalem artichoke|sunchoke|\bchicory\b|dandelion root|\bagave\b|\bburdock\b/i,
  'A long-chain prebiotic fiber. Effective at feeding gut bacteria and notorious for gas if you go from none to a lot in one sitting.')
g('Curcumin', /turmeric|curcumin/i,
  'The yellow compound in turmeric. Poorly absorbed on its own — black pepper and fat both improve it measurably, which is why so many traditional recipes include both.')
g('Piperine', /black pepper|peppercorn/i,
  'The pungent compound in black pepper. It raises absorption of several other compounds, curcumin most dramatically.')
g('Capsaicin', /chil[ei]|chilli|cayenne|jalape|habanero|serrano|sriracha|red pepper flake|\bgochujang\b|\bharissa\b|\bpaprika\b/i,
  'What makes chili hot, by triggering a heat receptor rather than causing damage. Small metabolic and appetite effects show up in trials; the effect size is modest.')
g('Gingerols', /\bginger\b(?!bread)/i,
  'Ginger’s pungent compounds. Nausea is the one use with reasonably consistent human evidence, including in pregnancy and after surgery.')
g('Cinnamaldehyde', /cinnamon/i,
  'Cinnamon’s main aromatic compound. Blood-sugar effects have been studied with mixed results. Worth knowing: cassia cinnamon, the ordinary supermarket kind, contains coumarin, which matters only at daily-supplement amounts.')
g('Oleocanthal', /extra.?virgin olive oil|\bolive oil\b|\bolives\b/i,
  'The compound behind the peppery catch at the back of the throat in good extra-virgin oil. It inhibits the same enzymes as ibuprofen in the lab, far more weakly. A sharp-tasting oil is a fresher oil.')
g('Flavanols', /cocoa|cacao|dark chocolate|\bcacao nibs\b/i,
  'Cocoa flavanols have some of the better evidence for blood-vessel function. Dutch-process cocoa loses most of them to alkali, and milk chocolate has little to begin with.')
g('EGCG and catechins', /green tea|\bmatcha\b|white tea/i,
  'Green tea polyphenols, antioxidant and mildly thermogenic. Tea also binds non-heme iron, so between meals is better than with them if iron is a concern.')
g('L-theanine', /green tea|\bmatcha\b|black tea/i,
  'An amino acid almost unique to tea, associated with calm alertness alongside caffeine. Matcha has the most since you drink the whole leaf.')
g('Resveratrol', /red wine|\bgrapes?\b|\bpeanuts?\b/i,
  'The polyphenol in grape skin that got all the press. Food amounts are far below anything used in the studies, so treat it as a nice extra, not a reason to drink.')
g('Resistant starch', /\bpotatoes?\b|\brice\b|\bpasta\b|green banana|plantain|\blentils?\b|\bbeans\b|chickpeas?|\bbarley\b|\boats?\b/i,
  'Starch that resists digestion and feeds gut bacteria instead. Cooking then cooling potatoes, rice or pasta creates it, and reheating keeps most of it — leftovers are genuinely different food.')
g('Ergothioneine', /mushrooms?|shiitake|maitake|cremini|portobello|oyster mushroom|porcini|\benoki\b/i,
  'An unusual amino acid that mushrooms are by far the best dietary source of; the body has a dedicated transporter for it, which is a hint it matters. Research is young.')
g('Vitamin D from mushrooms', /mushrooms?|shiitake|maitake|portobello|cremini/i,
  'Mushrooms make D2 under ultraviolet light. Sun-dried or UV-treated ones carry a lot; ordinary shop mushrooms grown in the dark carry very little. Sunning them yourself does work.')
g('Beta-carotene', /\bcarrots?\b|sweet potato|butternut|\bpumpkin\b|winter squash|\bmango|cantaloupe|\bapricot|red pepper|bell pepper/i,
  'Converted to vitamin A as needed, which is why plant sources cannot cause vitamin A toxicity the way liver or supplements can. Fat and some cooking both improve absorption.')
g('Vitamin C', /\borange(s)?\b|\blemon|\blime\b|grapefruit|clementine|mandarin|bell pepper|red pepper|\bkiwi\b|strawberr|broccoli|\bguava\b|black currant|\bpapaya\b|\brose hip/i,
  'Water-soluble and heat-sensitive, so raw or lightly cooked keeps most of it. It also roughly triples absorption of non-heme iron eaten in the same meal.')
g('Folate', /\blentils?\b|chickpeas?|\bspinach\b|\basparagus\b|\bavocado|black beans|\bbroccoli\b|romaine|beet greens|\bedamame\b/i,
  'The natural form of B9, central to cell division. Legumes and leafy greens are the densest whole-food sources, and boiling leaches a fair amount into the water.')
g('Heme iron', /\bbeef\b|\bsteak\b|\blamb\b|\bliver\b|\bvenison\b|\bbison\b|\bduck\b|\boysters?\b|\bclams?\b|\bmussels?\b|blood sausage/i,
  'The animal form, absorbed several times better than iron from plants and not much affected by what else is on the plate.')
g('Non-heme iron', /\blentils?\b|chickpeas?|\bspinach\b|\btofu\b|pumpkin seed|\bpepitas?\b|blackstrap molasses|white beans|\bquinoa\b|fortified cereal/i,
  'The plant form, absorbed less efficiently and blocked by tea, coffee and calcium in the same meal. Vitamin C alongside it helps substantially.')
g('Selenium', /brazil nut|\btuna\b|\bsardines?\b|\bhalibut\b|\bshrimp\b|\beggs?\b|sunflower seed|\bliver\b/i,
  'Needed for thyroid hormone and antioxidant enzymes. Brazil nuts are extreme: one or two can cover a day, and a handful daily is genuinely too much.')
g('Iodine', /\bnori\b|\bkombu\b|\bwakame\b|seaweed|\bdulse\b|\bkelp\b|\bcod\b|\bshrimp\b|\bmilk\b|\byogh?urt\b|iodized salt|\bprawns?\b/i,
  'Essential for thyroid hormone, and easy to fall short of if you avoid dairy, seafood and iodized salt. Kelp swings the other way — it can carry many times a day’s worth per gram.')
g('Potassium', /\bbananas?\b|\bpotatoes?\b|sweet potato|white beans|\bavocado|\bspinach\b|\bbeets?\b|\byogh?urt\b|\bsalmon\b|tomato paste|\bapricot|\bprunes?\b|coconut water/i,
  'Most people get well under the recommended amount, and it works against sodium on blood pressure. Potatoes and beans beat bananas per serving.')
g('Magnesium', /pumpkin seed|\bpepitas?\b|\balmonds?\b|\bcashews?\b|dark chocolate|\bspinach\b|black beans|\bquinoa\b|swiss chard|\bedamame\b/i,
  'Involved in hundreds of enzyme reactions, and another nutrient most people run low on. Seeds, nuts, legumes and greens are the reliable sources.')
g('Live cultures', /\byogh?urt\b|\bkefir\b|sauerkraut|\bkimchi\b|\bmiso\b|\btempeh\b|\bnatto\b|kombucha|\bskyr\b|labneh|cr[eè]me fra[îi]che/i,
  'Fermented foods with living bacteria, which is not the same as a probiotic supplement with a named strain. Pasteurised or cooked versions — shelf-stable sauerkraut, boiled miso — have none left alive.')
g('Vitamin K2 (menaquinone)', /\bnatto\b|\bgouda\b|\bedam\b|hard cheese|\bcheese\b|egg yolk|\bliver\b|\bgoose\b/i,
  'The bacterial form of vitamin K, involved in directing calcium to bone. Natto is in a league of its own; aged cheeses are the everyday source.')
g('Glycine and collagen', /bone broth|\boxtail\b|\bshanks?\b|pork belly|chicken feet|\bgelatin\b|\btrotters?\b|\bskin.on\b/i,
  'Long-simmered connective tissue gives gelatin and a lot of glycine. The eaten collagen does not travel to your own joints intact, but the amino acids are genuinely useful.')
g('Taurine', /\bscallops?\b|\bmussels?\b|\bclams?\b|\boctopus\b|\bsquid\b|calamari|\bshrimp\b|dark meat|\bturkey leg/i,
  'Concentrated in shellfish and dark poultry meat. Involved in bile salts, heart and retinal function; it is also why it ended up in energy drinks.')
g('Betaine', /\bbeets?\b|wheat germ|\bquinoa\b|\bspinach\b|\brye\b/i,
  'Works with choline and folate in the methylation pathway, and is also studied in sports performance. Beets and wheat germ are the standouts.')
g('Spermidine', /wheat germ|\bnatto\b|\bsoybeans?\b|aged cheese|mushrooms?|\bpeas\b|\bchickpeas?\b/i,
  'A polyamine involved in cellular recycling, which is why it shows up in longevity research. Wheat germ is the densest ordinary source.')
g('Coenzyme Q10', /\bliver\b|\bkidneys?\b|\bheart\b|\bsardines?\b|\bmackerel\b|\bbeef\b|\bpeanuts?\b|\bspinach\b|soybean oil|\bpistachio/i,
  'Part of how mitochondria make energy, and your body makes most of its own. Organ meats and oily fish lead; beef, peanuts and spinach contribute modestly.')
g('Bromelain and papain', /pineapple|\bpapaya\b/i,
  'Protein-digesting enzymes, which is why both are traditional meat tenderisers and why fresh pineapple or papaya stops gelatin from setting.')
g('Citrulline', /watermelon|\bcucumber\b|\bmelon\b/i,
  'An amino acid concentrated in watermelon, especially the white rind, that the body turns into arginine and then nitric oxide.')
g('Lignans', /flax\s?seed|flaxseed|ground flax|\bsesame\b|\btahini\b|\brye\b|sunflower seed/i,
  'Plant compounds that gut bacteria convert into weak oestrogen-like molecules. Flax has by far the most — and only ground flax, since whole seeds pass through intact.')
g('Phenolics in coffee', /\bcoffee\b|espresso|cold brew/i,
  'Coffee is most people’s largest source of dietary polyphenols, chlorogenic acids above all. Unfiltered coffee — French press, espresso, boiled — also carries diterpenes that nudge LDL cholesterol up; a paper filter removes them.')
g('Nitrate-rich greens', /\bwatercress\b|\bbeet greens\b|\boak leaf\b/i,
  'Among the most nutrient-dense foods per calorie there are, and high in dietary nitrate.')
g('B12', /\bclams?\b|\bliver\b|\bsardines?\b|\bsalmon\b|\bbeef\b|\beggs?\b|nutritional yeast|fortified/i,
  'Only reliably present in animal foods and fortified products. Clams and liver are extraordinarily high; on a plant-based diet this is the one that needs a deliberate source.')
g('Monounsaturated fat', /\bavocado|\bolive oil\b|\bolives\b|\balmonds?\b|\bpecans?\b|hazelnut|\bcashews?\b|\bmacadamia/i,
  'The fat type the Mediterranean-diet evidence is built around. Also stable enough for everyday cooking heat, contrary to the common worry about olive oil.')

// ─── cautions ───────────────────────────────────────────────────────────────────
c('High-mercury fish', /\bswordfish\b|\bshark\b|king mackerel|\btilefish\b|bigeye tuna|\bmarlin\b|orange roughy/i,
  'These are the fish the FDA says to avoid entirely if you are pregnant, breastfeeding or feeding young children, because mercury accumulates in the big long-lived predators.')
c('Moderate-mercury fish', /\btuna\b|albacore|yellowfin|\bmahi.?mahi\b|\bgrouper\b|\bsea bass\b|\bhalibut\b|\bsnapper\b/i,
  'Middling mercury. The FDA guidance is about one serving a week of these, versus two to three of salmon, sardines or shrimp. Canned light tuna is lower than albacore.')
c('Processed meat', /\bdeli meat|cold cuts?|\bprosciutto\b|\bsalami\b|\bbologna\b|hot dogs?|\bbacon\b|\bsausage\b|\bpepperoni\b|\bham\b|\bpastrami\b|\bchorizo\b|\bcorned beef\b/i,
  'Classified by the IARC as a group 1 carcinogen, mainly on colorectal cancer, with nitrite curing and high-heat cooking both implicated. The risk is about how regularly, not about one sandwich.')
c('Listeria risk', /unpasteuri[sz]ed|raw milk|\bbrie\b|\bcamembert\b|queso fresco|blue cheese|gorgonzola|roquefort|\bfeta\b|deli meat|cold cuts?|smoked salmon|\blox\b/i,
  'Soft and unpasteurised cheeses, deli meats and cold-smoked fish can carry listeria, which is mild for most people and serious in pregnancy. Heating until steaming removes the risk.')
c('Raw egg', /raw eggs?|\bmeringue\b|\btiramisu\b|\beggnog\b|\baioli\b|\bmousse\b|cookie dough|hollandaise/i,
  'Small salmonella risk, which matters for pregnancy, young children, the elderly and anyone immunocompromised. Pasteurised eggs solve it without changing the recipe.')
c('Raw flour', /cookie dough|raw flour|raw dough|\bbrownie batter\b/i,
  'Flour is a raw agricultural product and has caused E. coli outbreaks — tasting raw dough is a real if small risk, separate from the egg.')
c('Dried beans need a hard boil', /dried kidney beans|raw kidney beans|\bkidney beans\b|\bcannellini\b|\bfava beans?\b/i,
  'Raw and undercooked red kidney beans contain phytohaemagglutinin and cause sharp stomach upset. Ten minutes at a full boil destroys it; a slow cooker alone may not get hot enough.')
c('Green potatoes', /\bpotatoes?\b/i,
  'Green patches and sprouts mean solanine, which is bitter and mildly toxic. Cut them away generously, and store potatoes dark rather than in the light.')
c('Oxalates', /\bspinach\b|\brhubarb\b|swiss chard|\bbeets?\b|\balmonds?\b|\bchard\b|beet greens|\bcocoa\b/i,
  'High-oxalate foods matter if you have had calcium-oxalate kidney stones. They also bind the calcium and iron in the same meal — boiling and draining removes a good share.')
c('Rhubarb leaves', /\brhubarb\b/i,
  'The stalks are food; the leaves are not, being high enough in oxalic acid to be genuinely poisonous. Cut and discard them.')
c('Vitamin A in liver', /\bliver\b|\bp[aâ]t[eé]\b|\bliverwurst\b/i,
  'Liver is so dense in preformed vitamin A that regular large portions can reach toxic amounts, and it is advised against in pregnancy. Once in a while is a different matter.')
c('Raw shellfish', /raw oysters?|\boysters?\b|raw clams?|\bceviche\b|\bsashimi\b|\btartare\b/i,
  'Raw shellfish and fish carry vibrio, norovirus and parasite risk. Commercially frozen fish is safer for raw dishes; neither lemon juice nor alcohol makes raw fish safe.')
c('Raw sprouts', /alfalfa sprouts|bean sprouts|mung bean sprouts|raw sprouts|\bsprouted seeds\b/i,
  'The warm humid conditions sprouts need also suit salmonella, and the seed is the source, so rinsing does not fix it. Cooking does.')
c('Grapefruit and medication', /grapefruit|\bpomelo\b|seville orange/i,
  'Grapefruit blocks an enzyme that clears many common drugs — statins, some blood-pressure and anxiety medicines — which can push their levels up. Worth checking against anything prescribed.')
c('Licorice root', /licorice|liquorice/i,
  'Real licorice root, not anise flavouring, contains glycyrrhizin, which raises blood pressure and lowers potassium at fairly ordinary amounts eaten daily.')
c('Nutmeg in quantity', /\bnutmeg\b|\bmace\b/i,
  'Fine by the pinch. Tablespoon amounts contain enough myristicin to cause real toxicity, which is occasionally a problem in holiday baking scaled up carelessly.')
c('Honey and infants', /\bhoney\b/i,
  'Never for babies under one year, because of botulism spores. No issue for anyone older.')
c('Caffeine', /\bcoffee\b|espresso|cold brew|\bmatcha\b|green tea|black tea|energy drink|\bguarana\b|\byerba mate\b/i,
  'The usual guidance is up to about 400 mg a day for adults and 200 mg in pregnancy — roughly two to four cups of coffee, and one to two in pregnancy.')
c('Alcohol', /\bwine\b|\bbeer\b|\bbourbon\b|\bvodka\b|\brum\b|\bbrandy\b|whiske?y|\bsherry\b|\bcognac\b|\bliqueur\b|\btequila\b/i,
  'Simmering removes some alcohol but not all of it — a long-braised dish keeps a few percent. No amount is considered risk-free, and none is advised in pregnancy.')
c('Cassava', /\bcassava\b|\byuca\b|\byucca\b/i,
  'Must be peeled and thoroughly cooked; raw or badly processed cassava contains cyanogenic compounds. The processed flour and tapioca sold in shops are fine.')
c('Star fruit', /star fruit|carambola/i,
  'Contains a neurotoxin that healthy kidneys clear easily and impaired kidneys do not. Anyone with kidney disease should avoid it.')
c('Raw elderberries', /elderberr/i,
  'Raw berries, and all the leaves and stems, cause nausea and vomiting. Cooked, strained elderberry is the only form to use.')
c('Worth buying organic', /strawberr|\bspinach\b|\bkale\b|collard|mustard greens|\bgrapes?\b|\bpeach|\bpears?\b|nectarine|\bapples?\b|bell pepper|hot pepper|\bcherr(y|ies)\b|blueberr|green beans/i,
  'These are the crops that repeatedly top the EWG’s residue rankings, mostly thin-skinned fruit and leafy greens. If you buy organic selectively, this is where it buys you the most.')
c('No need to buy organic', /\bavocado|sweet corn|pineapple|\bonions?\b|\bpapaya\b|frozen peas|\basparagus\b|honeydew|\bkiwi\b|\bcabbage\b|watermelon|mushrooms?|\bmango|sweet potato|\bcarrots?\b/i,
  'Consistently among the lowest-residue produce, usually because of a peel or husk. Conventional is a sensible saving here.')
c('Acrylamide', /french fries|hash brown|potato chips|\bcrisps\b|roast potatoes|\btoast\b/i,
  'Forms when starchy food is browned hard — deep-fried, roasted dark, toasted black. Golden rather than brown is the practical advice, and it applies to coffee roasting and biscuits too.')
c('Goitrogens, raw', /raw kale|kale smoothie|raw cabbage|raw broccoli|\bcoleslaw\b/i,
  'Raw brassicas contain compounds that interfere with iodine uptake. Only relevant in large daily raw amounts, and cooking largely deals with it.')
c('Added sugar', /\bsyrup\b|\bsoda\b|\bcola\b|sweetened condensed|corn syrup|\bfrosting\b|\bicing\b/i,
  'The FDA Daily Value is 50 g of added sugar a day. Liquid sugar is the easiest way past it without noticing.')
c('Nut and sesame allergens', /\bpeanuts?\b|peanut butter|\balmonds?\b|\bcashews?\b|\bpistachio|hazelnut|\bwalnuts?\b|\bpecans?\b|\bsesame\b|\btahini\b/i,
  'Among the most common severe allergens, and sesame is now a labelled major allergen in the US. Worth flagging if you are cooking for other people.')

export const NOTABLES = E

/**
 * Entries whose keyword appears in the text. Goodies first, then cautions, each in table order
 * so the output is stable. `limit` keeps a long ingredient list from producing a wall of cards.
 */
export function matchNotables(text, limit = 14) {
  const hay = String(text || '')
  if (!hay.trim()) return []
  const hits = NOTABLES.filter((n) => n.re.test(hay)).map(({ id, t, label, text: body }) => ({ id, t, label, text: body }))
  return [...hits.filter((h) => h.t === 'good'), ...hits.filter((h) => h.t === 'caution')].slice(0, limit)
}

/** For a recipe: match against the name and the ingredients, which is where the food words are. */
export const notablesForRecipe = (r, limit) => matchNotables(`${r?.name || ''}\n${r?.ingredients || ''}`, limit)

/** Merge curated hits with anything the AI added, keeping the curated wording and dropping repeats. */
export function mergeNotables(curated, extra) {
  const out = [...(curated || [])]
  const seen = new Set(out.map((n) => n.label.toLowerCase().replace(/[^a-z0-9]/g, '')))
  for (const e of extra || []) {
    const label = String(e.label || '').trim()
    const body = String(e.text || '').trim()
    if (!label || !body) continue
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: 'ai-' + key, t: e.t === 'caution' || e.kind === 'caution' ? 'caution' : 'good', label, text: body, ai: true })
  }
  return [...out.filter((n) => n.t === 'good'), ...out.filter((n) => n.t === 'caution')]
}
