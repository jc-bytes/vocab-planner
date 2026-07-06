**Coffee Classification**n 
altieri.collect.admin.test@example.com
AltieriTest!Admin-2026

- Final classification list: 1ra, 2da, 3ra, selected green coffee, others?
	its always 1ra, 2da, or 3ra and it could be a % eg someone brough 30lb both only 70% is 1ra and 10 2da and 5 3ra 
- Are variety, process, classification all required per delivery?
	yes and need to be set before we start. we should set where we are and the coffee info to properly aligned it to what the people are bringing to be weigthed
- Are coffee type, variety, and process selected once per workday or per delivery?
once per delivery

**Payments**

- Price per lata: global, by classification, by coffee type, by date, by worker?
i think this is by coffee
- Are bonuses, penalties, deductions, or advances needed?
not yet
- Does the payment table need export to Excel/PDF?
yes
- Who approves payment tables?
we can have that as a permission
- Can payment calculations be regenerated after corrections?
yes

**Offline And Sync**

- How long must the app work offline?
for as long as needed maybe if too long passes download into csv or similar
- Can multiple devices register the same workday?
yes we have many places working at the same time
- What happens if two devices record the same worker at the same time?
that cant be since that would mean the same user is in 2 places at once
- What conflict rules do we need?
help me decide
- What data must be available offline: workers, photos, embeddings, lots, parcels, prices?
what can a tablet support?

**Technical Stack**

- Frontend framework: I’d suggest React/Vite or Next.js static/PWA mode.
- Supabase project structure: one project for Harvest, separate from Sensory.
- Cloudflare Pages for hosting.
- ONNX model choice: likely AuraFace-v1 candidate, pending test.
- Storage strategy for worker photos and embeddings. probalby supabase storage
- Whether biometric embeddings need encryption at rest. can you explain this one to me in simple terms?

**Hardware**

- Target device: tablet, phone, laptop, kiosk? tablet
- Camera quality and placement. depends on device
- Field lighting conditions. depends on site
- Internet availability during harvest. we are trying to always have.
- Later scale integration protocol. yes we need to intagrate it later with backup manual