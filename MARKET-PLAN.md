# Go-to-market plan for Commit

Everything below is judgment, not verified research. Competitor pricing and user numbers were not confirmed, so the prices and targets are hypotheses to test.

## 1. Target market

**Beachhead: people with a fitness goal who have already failed to stick to it.**
- Gym attendance is easy to prove with a photo, a check-in or a wearable.
- Motivation drops sharply after a few weeks, which is when stakes help most.
- Missing a workout has a clear and quick cost, which makes the stake credible.

**Primary persona: "The Restarter"**
- Aged 22-35, urban, employed or a student.
- Pays for a gym membership but goes inconsistently.
- Has tried habit apps and quit them within weeks.
- Comfortable putting about $5-20 on a goal.

**Secondary personas (later):**
- Students with revision or study blocks.
- Freelancers and remote workers with focus blocks.
- Employers, gyms and coaches, as the B2B route StickK took.

**Avoid at launch:** broad "all habits for everyone", medical goals, and anyone under 18, because of payment and legal complexity.

## 2. Positioning

> "Commit: put money on your goal. Miss it and it goes to charity. Prove it with a photo."

| Against | Your angle |
|---|---|
| StickK | Faster setup and automatic proof, not a referee you have to recruit |
| Beeminder | No spreadsheets or data tracking to learn |
| Habit trackers | Real consequences instead of streaks |

The onboarding (goal, blocker, free time, stake) and the task guide are the differentiator. Few people use stakes, so lowering the barrier to starting is the main opportunity.

## 3. Pricing

**Core design:** the stake is the user's own money, held in escrow. It is refunded if they succeed and donated if they miss. The stake itself is never revenue.

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 1 active task, stakes up to $10, basic proof |
| **Plus** | $5.99/mo or $39/yr | Unlimited tasks, higher stakes (up to $100), task assist, history and stats |
| **Teams (later)** | $3-5/user/mo | Group challenges for gyms and employers |

Why:
- **Free tier with a real stake.** Users feel the mechanism before paying.
- **Subscription, not a cut of forfeits.** Keeping lost money creates a conflict of interest and a trust problem. The pitch is charity.
- **Optional payment fee:** pass through card processing costs (about 3%) if needed.

**Test before committing.** Run a price test between $3.99, $5.99 and $7.99 per month, and watch conversion and 30-day retention.

## 4. Channels

1. **Fitness communities:** Reddit (r/fitness, r/getdisciplined), gym Discords, and January and September "reset" seasons.
2. **Short-form video:** "I bet $20 I'd go to the gym 12 times" challenge content with real charity payouts.
3. **Charity partnerships:** each charity promotes the app to its own audience. Publish a "total donated" counter.
4. **University cohorts:** exam-season pilots with student societies.
5. **Gym partnerships:** later, as a retention tool the gym pays for.

## 5. Phased roadmap

| Phase | Timing | Goal | Work |
|---|---|---|---|
| **0. Validate** | Weeks 1-3 | Prove people will stake money | Landing page with waitlist, 20 interviews, manual pilot with 20-30 users using Venmo or Stripe links |
| **1. MVP** | Weeks 4-10 | Working product | Real backend (replace mock data), Stripe escrow, photo proof, 3-5 charities, legal review |
| **2. Launch** | Weeks 11-16 | First 500 paying users | Fitness beachhead, referral loop (invite a friend, both get a free stake) |
| **3. Expand** | Months 5-9 | Retention and second market | Study and work goals, wearables for proof, annual plans |
| **4. B2B** | Months 9+ | Revenue diversification | Gym and employer pilots |

## 6. Success metrics

Starting targets for the pilot, not benchmarks from research.

- **Validation:** 100+ waitlist signups, and 30% of pilot users staking real money.
- **Activation:** over 40% of signups create a task with a stake.
- **Retention:** over 30% still active at day 30.
- **Conversion:** 5-8% free to Plus.
- **Trust:** payout disputes under 2% of forfeits.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Legal:** money-at-stake could be treated as gambling in some states | Get legal review first. Use charity-only forfeits and a skill-based framing. Launch in a few states if needed. |
| **Cheating on proof** | Photo with a timestamp, location check, or AI review. Start with light friction and tighten after seeing abuse. |
| **Users fear losing money and never start** | Free tier with a small stake, a "first miss is free" option, and clear refund rules. |
| **Churn after the first win** | Streak bonuses, escalating stakes, group challenges. |
| **Payment handling** (escrow, refunds, chargebacks) | Use Stripe, keep terms clear, and set a minimum stake large enough to cover fees. |

## 8. Open decisions
- Keep forfeited money as revenue, or send all of it to charity? This changes pricing, legal risk and brand.
- Is the first market the US, or somewhere else? Regulation and payments differ.
- Solo project or team? That decides how realistic Phases 1-2 are.

## Sources from the market research
- [StickK (Wikipedia)](https://en.wikipedia.org/wiki/StickK)
- [Beeminder vs StickK discussion](https://forum.quantifiedself.com/t/beeminder-com-like-stickk-com-for-data-nerds-graphing-commitment-contracts/236)
- [Habit tracking app market estimate](https://skynex.alwaysdata.net/blogs/476/Habit-Tracking-Apps-Market-Growth-Productivity-and-Self-Improvement-App?lang=en_us) (single syndicated estimate)
- [Put Your Money Where Your Mouth Is (ICWSM)](https://ojs.aaai.org/index.php/ICWSM/article/view/31440) (observational study of stickK commitments)
- [Forfeit: Habit Commitment (App Store)](https://apps.apple.com/ci/app/forfeit-habit-commitment/id6760597781)
- [Is Skill-Based Gambling Legal in Your State?](https://tech.co/?p=96818) (secondary source, not a legal survey)
