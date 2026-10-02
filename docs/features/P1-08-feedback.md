# P1-08 Guest feedback, Google review option, manager alerts

**Status:** done (pitch build), "save as Review" waits for Phase 2.

## Built
- Feedback: 1–5 rating, tags (service, plats, attente, prix, propreté, ambiance), comment, optional contact only with an explicit consent tick (the contact is dropped on the server without consent), table from the QR or the picked table.
- Google button ("Laisser un avis sur Google", link `https://search.google.com/local/writereview?placeid=<id>`) rendered outside the rating flow: same text and place for every guest, before and after sending, whatever the rating. No rewards.
- Ratings of 3 or less alert the staff board immediately (Server-Sent Events).
- Owner sets the Google Place ID in Restaurant settings, with a link to Google's Place ID finder.
- Feedback page shows tags, table and consented contact.

## Acceptance
- [x] The Google button renders identically for ratings 1 and 5 (browser test checks it before and after a 2/5 rating)
- [x] Low-rating alert arrives within 10 seconds (immediate on the board; email/WhatsApp alerts come with P0-08/P3-05)
- [ ] Feedback also saved as a `Review` (source in_app): the Review model arrives in Phase 2
- [x] Owner sets the Google Place ID once; a helper explains where to find it
