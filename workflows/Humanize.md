---
name: "🗣️ Humanize"
id: "__humanize__"
prompt: "{=CONTEXT=}"
replaceSelection: true
humanize: false
providerId: "default-claude-cli"
---
Rewrite AI-generated text to sound human. 
# Humanizer

Two passes, in order. Pass 1 strips AI tells. Pass 2 adds light human fingerprints (style choices, not errors). Preserve all facts, names, numbers, quotations, and POV. Cut 15-25% of words. Vary sentence length.

## Absolute rule: zero em dashes

No em dashes (—) or en dashes (–) in prose. Not one. Use a comma, colon, parentheses, period, or the words _is / and / but / which_ instead. Re-read the output and strip any that snuck in. Hyphens in compounds and number ranges (1990-1995) are fine.

## Pass 1: strip the AI tells

Find each pattern, cut or rewrite. Don't itemize fixes in the output.

**1.1 Inflated significance.** _stands as / serves as a testament to, marks a pivotal moment, marks a key turning point, marking/shaping the, reflects a broader movement, underscores its importance, represents a shift toward, symbolizing its ongoing/enduring/lasting, contributing to the rich tapestry of, setting the stage for, an enduring legacy, deeply rooted, evolving landscape, focal point, indelible mark._ If a sentence's only job is to assert importance, delete it.

**1.2 Canned notability.** _independent coverage, profiled in major outlets, has been featured in, written by a leading expert, maintains an active social media presence, widely-read publications, national/regional/local/music/business/tech media outlets_ (when no specific outlet is named). Name the actual outlet or drop the claim.

**1.3 The "-ing tail" trap.** Sentences ending in a participle clause adding vague analysis. Triggers: _highlighting, underscoring, emphasizing, reflecting, symbolizing, contributing to, showcasing, ensuring, cultivating, fostering, encompassing, demonstrating, illustrating, marking._ Cut the tail or split into two sentences with a real second fact. If the tail attributes an opinion to a third party that probably didn't say it, definitely cut.

**1.4 Travel-brochure tone.** Nuke unless it's actually marketing copy: _boasts, vibrant, rich, profound, enhancing, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking, renowned, featuring, diverse array, sprawling, bustling, picturesque, hidden gem, must-see._

**1.5 AI vocabulary.** Replace or delete on sight; a cluster is the loudest tell. _additionally, align with, bolster, bolstered, boast, crucial, delve, dive deep/in, ecosystem (figurative), elevate, emphasize, enhance, enduring, foster, garner, highlight (verb), holistic, interplay, intricate, intricacies, journey (figurative), key (adjective), landscape (abstract), leverage, meticulous(ly), multifaceted, navigate (figurative), nuanced, pivotal, realm, resonate with, revolutionize, robust, seamless, showcase, tapestry, testament, underscore, unlock, valuable, valuable insights, vibrant, vital._ Delete sentence-starters _Additionally, Moreover, Furthermore, In conclusion, Ultimately, It is worth noting that, It's important to note that, In today's fast-paced world._ Also: AI defending itself loves _concrete evidence / concrete examples / in the absence of concrete..._; replace with "specific," "actual," or delete.

**1.6 "is/are" avoidance.** AI swaps copulas for promotional verbs; reverse it. _serves as / stands as / represents_ → "is." _boasts / features / offers_ → "has." _refers to_ (in lead sentences) → "is."

**1.7 Negative parallelisms.** _Not just X, it's Y. / Not X, but Y. / No X, no Y, just Z._ Pick one side. One per long document max.

**1.8 Rule of three.** _Adjective, adjective, and adjective._ Use one, two, or four. Avoid clean triplets.

**1.9 Weasel wording.** _experts argue, some critics have said, industry reports suggest, observers have noted, researchers widely agree, several sources, multiple publications, such as_ (before what looks like an exhaustive list). Name the source or drop the claim.

**1.10 "Despite challenges, bright future" formula.** _Despite [puff], [subject] faces challenges including [list of three]. However, with [ongoing initiatives], [subject] continues to [vague positive verb]..._ Cut the whole structure. If a challenge is real, write one specific sentence.

**1.11 Elegant variation.** AI hops synonyms (car → vehicle → automobile → ride) to avoid repetition. Pick one term and stick with it.

**1.12 Formatting tells.** Title Case Headings → sentence case. `**Bold Label:**` opening every list item → unbold; prose where possible. Em dashes → see absolute rule. Curly quotes ("" '') → straight (`"` `'`). Markdown thematic breaks (`---`) before every heading → remove. Skipped heading levels → fix.

**1.13 Knowledge-cutoff disclaimers.** Cut: _as of my last knowledge update, up to my last training update, as of [date]_ (as a hedge), _based on available information, while specific details are limited/scarce, in the available sources, not widely documented, likely [speculation], maintains a low profile_ (when AI knows nothing). If the writer doesn't know, leave it out.

**1.14 Chatbot leak.** Cut anything that sounds like the AI talking to its user: _I hope this helps, Of course!, Certainly!, You're absolutely right!, Great question!, Would you like me to..., Is there anything else..., Let me know if you'd like a more detailed breakdown, Here is a..._ Strip any leading "Subject:" line.

**1.15 Rigid intro/body/conclusion.** Dump explicit "Introduction" and "Conclusion" sections for short-to-medium pieces. Start with the point.

**1.16 Canned good-faith and openness boilerplate.** Common in comments/emails. Cut: _I am committed to, I assure you that, my intention/goal is to, aligns with [X's] goals/mission, adheres to [the] standards/policies/guidelines, in a responsible and constructive manner, with the utmost care and respect for, ensuring [neutrality/accuracy/compliance], If you have any concerns or suggestions, I am open to/welcome any further input/guidance/feedback, If there are specific sections that, I am willing to address, I would greatly appreciate your guidance, Please do not hesitate to._ Keep any real promise inside ("I'll send the revised draft Friday"); cut the rest.

**1.17 Placeholder text.** AI sometimes leaves Mad-Libs blanks visible: `[Your Name]`, `[link to source]`, `[Describe section]`, `2025-XX-XX`, `INSERT_SOURCE_URL`, `PASTE_URL_HERE`, all-caps bracket tokens. Fill in with real values or delete the sentence. Never hand back text with placeholders intact.

## Pass 2: the human fingerprint

After Pass 1, sprinkle in a few of these per page. Goal is texture, not error. Subtle only. Vary which ones you use. Match the register (casual gets more, formal gets fewer). Don't call attention to them. Still no em dashes.

Menu:

- **Start a sentence with a conjunction** (And, But, So, Or, Yet, Because).
- **End a sentence with a preposition** when natural: _"the kind of thing he'd been waiting for."_
- **Split an infinitive**: _"to really think about this."_
- **Sentence fragment for emphasis** (max one per page): _"Just like that."_
- **Causal "since" / concessive "while"**: _"Since you brought it up..." / "While I agree on the goal..."_
- **"Which" for a restrictive clause** (occasionally): _"The report which she sent..."_
- **Singular they/them**: _"Whoever left this, they need to come get it."_
- **Drop or add an Oxford comma** by the writer's rhythm.
- **"Different than"** (casual): _"different than I expected."_
- **"Try and"** for "try to": _"Let me try and figure it out."_
- **"Hopefully"** as a sentence adverb: _"Hopefully we'll know by Friday."_
- **Stylistic comma splice** with short related clauses (informal only): _"It wasn't a question, it was a dare."_
- **"Like" for "such as"** in informal text.
- **"Less"** with a countable noun (casual, sparingly).
- **"A lot"** for "many" (conversational).
- **"However"** sentence-initial without the standard comma.
- **Trailing adverb or tag clause**: _"...and they left, quickly. / which was weird."_
- **Mild redundancy** very sparingly: _"first started," "added bonus," "close proximity."_

**Pass 2 blacklist.** Never: _could/would/should of_, "literally" used wrong, _irregardless_, double negatives, misspellings, misused apostrophes (`it's` for `its`), subject-verb disagreement. Those look like errors, not style. Line: stylebook bickering = fair game; signals the writer doesn't know the rule = not.

## Workflow

1. Read input. Note register (casual / business / academic).
2. Pass 1 silently.
3. Pass 2 silently, calibrated to register (3-6 quirks per page).
4. Re-read; strip every em dash and en dash from prose.
5. Return only the rewritten text.

Leave a few fingerprints. Never an em dash.
