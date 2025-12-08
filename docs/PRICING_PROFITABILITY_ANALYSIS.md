# AllThrive AI - Pricing & Profitability Analysis

*Generated: December 2025*

---

## Recommended Pricing Structure

### Subscription Tiers

| Tier | Monthly | Annual | Credits/Month | Key Value |
|------|---------|--------|---------------|-----------|
| **Free / Explorer** | $0 | $0 | 20 | Try it out |
| **Community Pro** | $15 | $153 (15% off) | 200 | Full AI + community |
| **Pro + Learning** | $40 | $408 (15% off) | 200 | Community Pro + Go1 courses |
| **Creator** | $15 | $153 (15% off) | 200 | Community Pro + creator tools (8% marketplace fee) |

### Credit Costs by Action

| Action | Credits | Actual Cost | Your Revenue | Margin |
|--------|---------|-------------|--------------|--------|
| AI Chat | 1 | $0.04 | $0.05 | 20% |
| Prompt Battle | 10 | $0.27 | $0.50 | 46% |
| Infographic | 5 | $0.134 | $0.25 | 46% |

*Credit value: $0.05 per credit (based on $5 = 100 credits)*

### Credit Packs (One-time purchases)

| Pack | Price | Credits | $/Credit | Example Usage |
|------|-------|---------|----------|---------------|
| **Starter** | $5 | 100 | $0.05 | 100 chats OR 10 battles OR 20 infographics |
| **Booster** | $20 | 450 | $0.044 | 450 chats OR 45 battles OR 90 infographics |
| **Power** | $35 | 850 | $0.041 | 850 chats OR 85 battles OR 170 infographics |

---

## Cost Breakdown

### AI Provider: Azure GPT-4.1
- **Cost**: $0.02 per 1K tokens (both input and output)
- **Per 1M tokens**: $20.00
- **Per request** (2K tokens avg): $0.04
- **Credit cost**: 1 credit = $0.05 revenue → **20% margin**

### Go1 Courses
- **Cost**: $6.00 per user per month (Pro Learn tier only)

### Gemini (Prompt Battles - Text)
- **Model**: Gemini text model for battle prompts
- **Estimated cost**: ~$0.003/1K tokens
- **Cost per battle**: ~$0.006 (negligible)

### Gemini Image Generation
- **Model**: gemini-3-pro-image-preview
- **Input**: $0.0011 per image (560 tokens)
- **Output (1K-2K)**: **$0.134 per image** (1120 tokens @ $120/1M)
- **Output (4K)**: **$0.24 per image** (2000 tokens @ $120/1M)

**Prompt Battle Cost (2 images):**
- 2 images × $0.134 = **$0.27 per battle**
- Credit cost: 10 credits = $0.50 revenue → **46% margin**

**Infographic Cost:**
- 1 image × $0.134 = **$0.134 per infographic**
- Credit cost: 5 credits = $0.25 revenue → **46% margin**

### Monthly Overhead (Medium Estimate)
| Item | Cost |
|------|------|
| AWS (EC2, RDS, Redis, S3) | $500 |
| Marketing | $2,000 |
| Google Workspace | $50 |
| Domain/misc | $50 |
| **Total Overhead** | **$2,600/month** |

*Note: Does not include developer costs or Stripe fees (2.9% + $0.30/transaction)*

---

## Per-User Profitability Analysis (Credit System)

### Usage Assumptions
With 200 credits/month, users can mix actions. Example usage patterns:

| Pattern | AI Chats | Battles | Infographics | Credits Used |
|---------|----------|---------|--------------|--------------|
| Chat-heavy | 150 | 2 | 6 | 150 + 20 + 30 = 200 |
| Battle-heavy | 50 | 10 | 10 | 50 + 100 + 50 = 200 |
| Balanced | 100 | 5 | 10 | 100 + 50 + 50 = 200 |

### Cost Analysis by Usage Pattern

**Balanced Pattern (100 chats, 5 battles, 10 infographics):**

| Cost Type | Calculation | Amount |
|-----------|-------------|--------|
| AI Chat (100) | 100 × $0.04 | $4.00 |
| Battles (5) | 5 × $0.27 | $1.35 |
| Infographics (10) | 10 × $0.134 | $1.34 |
| Gemini Text | ~$0.03 | $0.03 |
| **Total Variable Cost** | | **$6.72** |

### Tier Profitability (Variable Costs Only)

| Tier | Revenue | AI Cost | Gemini Cost | Go1 | **Total Cost** | **Profit** |
|------|---------|---------|-------------|-----|----------------|------------|
| **Free** (20 credits) | $0 | $0.80 | $0.27 | $0 | $1.07 | **-$1.07** |
| **Community Pro** (200 credits) | $15 | $4.00 | $2.72 | $0 | $6.72 | **+$8.28** |
| **Pro Learn** (200 credits) | $40 | $4.00 | $2.72 | $6 | $12.72 | **+$27.28** |
| **Creator** (200 credits) | $15 | $4.00 | $2.72 | $0 | $6.72 | **+$8.28** + 8% fees |

*Assumes balanced usage pattern. Actual costs depend on user behavior.*

### With Overhead Allocation ($2,600/month ÷ 400 users = $6.50/user)

| Tier | Revenue | Variable Cost | Overhead | **Total Cost** | **Profit** |
|------|---------|---------------|----------|----------------|------------|
| **Free** | $0 | $1.07 | $6.50 | $7.57 | **-$7.57** |
| **Community Pro** | $15 | $6.72 | $6.50 | $13.22 | **+$1.78** |
| **Pro Learn** | $40 | $12.72 | $6.50 | $19.22 | **+$20.78** |
| **Creator** | $15 | $6.72 | $6.50 | $13.22 | **+$1.78** + 8% fees |

---

## Credit Pack Profitability

| Package | Price | Credits | Max Cost* | **Min Profit** | Min Margin |
|---------|-------|---------|-----------|----------------|------------|
| Starter | $5 | 100 | $2.70 | **+$2.30** | 46% |
| Booster | $20 | 450 | $12.15 | **+$7.85** | 39% |
| Power | $35 | 850 | $22.95 | **+$12.05** | 34% |

*Max cost assumes all credits used for battles (worst case: 10 credits × $0.027 cost)*

**Most likely profit (balanced usage):**

| Package | Price | Likely Cost | **Likely Profit** | Margin |
|---------|-------|-------------|-------------------|--------|
| Starter | $5 | $1.68 | **+$3.32** | 66% |
| Booster | $20 | $7.56 | **+$12.44** | 62% |
| Power | $35 | $14.28 | **+$20.72** | 59% |

**Credit packs are your profit center!** Even worst-case has 34%+ margin.

---

## Break-Even Analysis

### With $2,600/month Overhead

| Tier | Profit/User (with overhead) | Users Needed (alone) |
|------|----------------------------|----------------------|
| Community Pro | $1.78 | **1,461 users** |
| Pro Learn | $20.78 | **126 users** |
| Creator | $1.78 + fees | **1,461 users** (less with sales) |

### Realistic Mix (60% Community Pro, 30% Pro Learn, 10% Creator)

| Metric | Calculation | Value |
|--------|-------------|-------|
| Community Pro profit | 60% × $1.78 | $1.07 |
| Pro Learn profit | 30% × $20.78 | $6.23 |
| Creator profit | 10% × $1.78 | $0.18 |
| **Average profit/user** | | **$7.48** |
| **Users to break even** | $2,600 ÷ $7.48 | **348 paid users** |

---

## Path to Profitability

| Milestone | Paid Users | Monthly Profit |
|-----------|------------|----------------|
| Break even | 348 | $0 |
| +$1K profit | 482 | +$1,000 |
| +$5K profit | 1,016 | +$5,000 |
| +$10K profit | 1,685 | +$10,000 |

**Plus:** Credit pack sales add pure profit on top (34-66% margin)

---

## Why Credit System Works

### Old Model (Unlimited Battles/Infographics)
- 20 battles + 20 infographics = $8.04/user in Gemini costs
- Community Pro at $15 barely broke even

### New Credit Model
- Users self-regulate expensive actions
- 200 credits = ~5 battles + 10 infographics max (if no chats)
- Most users will do more chats, fewer battles → lower costs
- Expensive actions (battles) cost more credits → sustainable margins

### Credit Pricing Logic

| Action | Cost to You | Credits | Revenue | Margin |
|--------|-------------|---------|---------|--------|
| AI Chat | $0.04 | 1 | $0.05 | 20% |
| Battle | $0.27 | 10 | $0.50 | 46% |
| Infographic | $0.134 | 5 | $0.25 | 46% |

The credit costs reflect actual costs → users pay fairly for what they use.

---

## Key Metrics to Track

- **Credit utilization rate** - do users spend all 200 credits?
- **Credit spend distribution** - % on chats vs battles vs infographics
- **Credit pack conversion rate** - what % of users buy extra credits?
- **Average revenue per user (ARPU)** - subscription + credit packs
- **Cost per Active User (CAU)** - already tracked in your system

---

## Recommendations

1. **Implement credit system** - 200 credits/month for paid tiers
2. **Set credit costs**: Chat=1, Battle=10, Infographic=5
3. **Pro Learn value = Go1 courses**, same credits as Community Pro
4. **Creator pays $15** like Community Pro, gets creator tools free
5. **Push credit packs** - they're your profit center (34-66% margins)
6. **Track credit usage patterns** - adjust credit costs if needed
7. **Free tier = 20 credits** - enough to try, not enough to abuse

---

## Implementation Checklist

- [ ] Update backend to track credits instead of request count
- [ ] Implement credit costs per action type
- [ ] Update billing UI to show credits
- [ ] Update seed_billing.py with new credit amounts
- [ ] Add credit pack purchase flow
- [ ] Update pricing page to explain credit system
- [ ] Add credit usage analytics dashboard
