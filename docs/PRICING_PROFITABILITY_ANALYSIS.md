# AllThrive AI - Pricing & Profitability Analysis

*Generated: December 2025*

---

## Recommended Pricing Structure

### Subscription Tiers

| Tier | Monthly | Annual | AI Requests/Month | Key Value |
|------|---------|--------|-------------------|-----------|
| **Free / Explorer** | $0 | $0 | 20 | Try it out |
| **Community Pro** | $15 | $153 (15% off) | 150 | Full AI + community |
| **Pro Learn** | $40 | $408 (15% off) | 150 | Community Pro + Go1 courses |
| **Creator** | $15 | $153 (15% off) | 150 | Community Pro + creator tools (8% marketplace fee) |

### Token Packages (One-time purchases)

| Package | Price | Tokens | Cost per 1M Tokens |
|---------|-------|--------|-------------------|
| **Starter** | $5 | 100,000 | $50.00 |
| **Booster** | $20 | 500,000 | $40.00 |
| **Power** | $35 | 1,000,000 | $35.00 |

---

## Cost Breakdown

### AI Provider: Azure GPT-4.1
- **Cost**: $0.02 per 1K tokens (both input and output)
- **Per 1M tokens**: $20.00
- **Per request** (2K tokens avg): $0.04

### Go1 Courses
- **Cost**: $6.00 per user per month (Pro Learn tier only)

### Gemini (Prompt Battles - Text)
- **Model**: Gemini text model for battle prompts
- **Estimated cost**: ~$0.003/1K tokens
- **Expected usage**: ~20 battles/user/month
- **Est. cost per user**: ~$0.12/month

### Gemini Image Generation
- **Model**: gemini-3-pro-image-preview
- **Input**: $0.0011 per image (560 tokens)
- **Output (1K-2K)**: **$0.134 per image** (1120 tokens @ $120/1M)
- **Output (4K)**: **$0.24 per image** (2000 tokens @ $120/1M)

**Prompt Battles (2 images per battle):**
- 20 battles × 2 images = 40 images/month
- 40 × $0.134 = **$5.36/month**

**Infographics:**
- 20 infographics/month × $0.134 = **$2.68/month**

**Total Gemini Image Cost: $8.04/user/month**

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

## Per-User Profitability Analysis (150 AI Requests)

### Full Cost Table

| Tier | Revenue | AI Cost (GPT-4) | Gemini Text | Gemini Image | Go1 | Overhead/User* | **Total Cost** | **Profit/Loss** |
|------|---------|-----------------|-------------|--------------|-----|----------------|----------------|-----------------|
| **Free** (20 req) | $0 | $0.80 | $0.12 | $8.04 | $0 | $6.50 | $15.46 | **-$15.46** |
| **Community Pro** (150 req) | $15 | $6.00 | $0.12 | $8.04 | $0 | $6.50 | $20.66 | **-$5.66** |
| **Pro Learn** (150 req) | $40 | $6.00 | $0.12 | $8.04 | $6 | $6.50 | $26.66 | **+$13.34** |
| **Creator** (150 req) | $15 | $6.00 | $0.12 | $8.04 | $0 | $6.50 | $20.66 | **-$5.66** + 8% fees |

*Overhead per user based on 400 users ($2,600 ÷ 400 = $6.50)

### Without Overhead Allocation (Variable Costs Only)

| Tier | Revenue | AI Cost (GPT-4) | Gemini Text | Gemini Image | Go1 | **Total Cost** | **Profit/Loss** |
|------|---------|-----------------|-------------|--------------|-----|----------------|-----------------|
| **Free** (20 req) | $0 | $0.80 | $0.12 | $8.04 | $0 | $8.96 | **-$8.96** |
| **Community Pro** (150 req) | $15 | $6.00 | $0.12 | $8.04 | $0 | $14.16 | **+$0.84** |
| **Pro Learn** (150 req) | $40 | $6.00 | $0.12 | $8.04 | $6 | $20.16 | **+$19.84** |
| **Creator** (150 req) | $15 | $6.00 | $0.12 | $8.04 | $0 | $14.16 | **+$0.84** + 8% fees |

---

## Token Pack Profitability

| Package | Price | Tokens | Your Cost | **Profit** | Margin |
|---------|-------|--------|-----------|------------|--------|
| Starter | $5 | 100K | $2.00 | **+$3.00** | 60% |
| Booster | $20 | 500K | $10.00 | **+$10.00** | 50% |
| Power | $35 | 1M | $20.00 | **+$15.00** | 43% |

**Token packs are your profit center!**

---

## Break-Even Analysis

### With $2,600/month Overhead

| Tier | Profit/User (Variable) | Users Needed (alone) |
|------|------------------------|----------------------|
| Community Pro | $0.84 | **3,095 users** |
| Pro Learn | $19.84 | **131 users** |
| Creator | $0.84 + fees | **3,095 users** (less with sales) |

### Realistic Mix (60% Community Pro, 30% Pro Learn, 10% Creator)

| Metric | Value |
|--------|-------|
| Average profit/user | $6.46 |
| **Users to break even** | **403 paid users** |

---

## Path to Profitability

| Milestone | Paid Users | Monthly Profit |
|-----------|------------|----------------|
| Break even | 403 | $0 |
| +$1K profit | 558 | +$1,000 |
| +$5K profit | 1,177 | +$5,000 |
| +$10K profit | 1,951 | +$10,000 |

**Plus:** Token pack sales add pure profit on top (43-60% margin)

---

## ⚠️ Warning: Gemini Image Cost is Killing Margins

At $8.04/user/month for Gemini images, **Community Pro barely breaks even**.

**Options to improve:**
1. **Limit prompt battles** - e.g., 10 battles/month instead of 20
2. **Limit infographics** - e.g., 10/month instead of 20
3. **Raise Community Pro price** to $20 → +$5.84 profit
4. **Make battles/infographics a Pro Learn feature only**

---

## Key Metrics to Track

- **Actual tokens per request** (measure to validate 2K assumption)
- **Average quota utilization** (do users actually use all 150 requests?)
- **Token pack conversion rate** (what % of users buy extra tokens?)
- **Cost per Active User (CAU)** - already tracked in your system
- **Infographic generation rate** per user

---

## Recommendations

1. **Set AI quota to 150 requests** for all paid tiers (not 500/2000)
2. **Pro Learn value = Go1 courses**, not more AI tokens
3. **Creator pays $15** like Community Pro, gets creator tools free
4. **Push token packs** - they're your profit center (43-60% margins)
5. **Track actual usage** - users may not hit full quota
6. **Consider limiting infographics** - $2.68/user is significant
