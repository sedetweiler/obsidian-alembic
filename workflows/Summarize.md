---
name: "📋 Summarize"
id: "default-summarize"
prompt: "Summarize the following:\n\n{=CONTEXT=}"
replaceSelection: false
humanize: false
providerId: "default-claude-cli"
---
Read the text carefully. Then do the following: 
1. Extract the "so what." If a smart, busy person could only take away one actionable implication from this, what would it be and why? 
2. Identify the 3–5 non-obvious insights — things that aren't stated explicitly but can be inferred from the content. Skip anything the text already highlights as a key point. 
3. Find the tensions or contradictions. Where does the argument conflict with itself, or with conventional wisdom? What's left unresolved? 
4. Name what's missing. What question does this document raise but never answer? What would you want to know next?

Rules:
- Lead with the single most important point, not background context
- Use tight bullet points, one idea per bullet
- Include specific numbers, names, and dates when they appear in the source; vague generalizations are useless
- If the text contains a decision, conclusion, or recommendation, that goes first
- Do not include filler bullets that only say the document "covers" or "discusses" something

Do not write: "Here is a summary", "The text discusses", "Overall", or any other preamble or conclusion.
Start immediately with the first bullet.
