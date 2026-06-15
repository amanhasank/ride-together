# RideTogether — Reddit feedback posts

Demo URL: https://ride-together-eight.vercel.app/

> Strategy: post as a **text/self post** (link in the body, not a link post). Ask for
> criticism, not praise. Reply to every comment. Read each subreddit's rules — many
> ban self-promo or require flair / minimum karma. Post to ONE sub at a time
> (cross-posting the same text quickly = spam filter + bans).

---

## Variant A — r/SideProject  (also fits r/indiehackers, r/webdev "Showoff Saturday")

**Title:** I built a no-install live map for group rides (bikers/cyclists/road trips) — tell me why this won't work

Every group ride I've been on has the same problem: half the group gets separated, and
the group chat turns into "where are you guys??" for the next 20 minutes. Existing fixes
all need everyone to install an app and make an account, which never happens when you've
got 12 people in a parking lot ready to roll.

So I built **RideTogether**: one person creates a ride, shares a link/QR, everyone opens
it in their phone browser and they're all on the same live map. No app, no signup. The
ride leader can drop a destination and everyone sees the route + their ETA, sorted by
who's closest.

Live demo (create a ride and open the link on another phone): https://ride-together-eight.vercel.app/

I'm not trying to sell anything — it's a side project and I want to know if it's actually
useful or if I'm fooling myself. Specifically:

- The hardest problem: phone browsers **stop sharing location when the screen locks**. I
  handle it gracefully (shows "last seen", marks stale riders), but continuous tracking
  really wants a native app. Is the no-install tradeoff worth losing background tracking,
  or is that a dealbreaker for you?
- Would you actually use this on a real ride, or is WhatsApp / Google Maps location
  sharing already "good enough"?
- If you organize group rides/events — what would make this genuinely useful vs. a toy?

Brutal feedback welcome. What breaks it?

---

## Variant B — niche community (r/motorcycles, r/bicycling, r/MTB, local riding subs)

> WARNING: these subs are strict about promotion. Check rules first, consider messaging
> mods, and lead with the riding problem — not the tech. Drop the "I built" framing if
> the sub is hostile to it and just ask the question, linking the demo only if asked.

**Title:** How do you keep a group together on a ride when people get separated?

Genuine question for people who ride in groups. Every ride I'm on, someone misses a turn
or stops for fuel and then it's 20 minutes of "where are you" in the group chat. Phone
mounts help but messaging is clumsy at speed.

I got fed up and built a little web thing for my own group — you open one link (no app,
no account) and everyone shows up on the same live map, with the destination and ETA.
Sharing it because I want to know how others solve this, and whether something like this
would actually help or if I'm overcomplicating a non-problem.

Curious what you all use, and what an ideal solution would do. (Happy to share the link
if it's allowed / anyone wants to try it.)

---

## Subreddits to consider (check rules + flair for each)
- r/SideProject — friendliest for "I built X, feedback?"
- r/indiehackers — founder/feedback audience
- r/webdev — only in the weekly "Showoff Saturday" thread
- r/InternetIsBeautiful — only if framed as a cool tool, NOT self-promo (risky, strict)
- r/motorcycles, r/bicycling, r/MTB, r/CarAV, r/roadtrip — target users, but promo-averse
- Local/club subreddits and Discords — often the most receptive for real trials
