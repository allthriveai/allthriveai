# Token Pack Pricing Analysis

## Current Token Pack Pricing

| Package | Tokens | Price | Price per 1K tokens |
|---------|--------|-------|---------------------|
| Starter | 100,000 | $5 | $0.05 |
| Booster | 500,000 | $20 | $0.04 |
| Power | 1,000,000 | $35 | $0.035 |

## Latest Frontier Model API Pricing (2025)

| Model | Input (per 1M) | Output (per 1M) | Notes |
|-------|----------------|-----------------|-------|
| **Claude Opus 4.5** | $5.00 | $25.00 | 90% off with prompt caching |
| **GPT-5** | $1.25 | $10.00 | 90% off with prompt caching |
| **Gemini 2.5 Pro** | $1.25 | $10.00 | (≤200K context) |
| **Gemini 3 Pro Preview** | $2.00 | $12.00 | Latest preview |

### Budget Models for Comparison

| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|-----------------|
| Claude 3.5 Sonnet | $3.00 | $15.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| Gemini 1.5 Flash | $0.075 | $0.30 |
| Gemini 2.0 Flash | $0.10 | $0.40 |

## Profitability Analysis by Model

### Token Pack Cost vs Revenue

| Package | Tokens | Revenue | Claude Opus 4.5 Cost | GPT-5 Cost | Gemini 2.5 Pro Cost |
|---------|--------|---------|---------------------|------------|---------------------|
| Starter | 100K | $5 | $1.50-2.50 | $0.56 | $0.56 |
| Booster | 500K | $20 | $7.50-12.50 | $2.81 | $2.81 |
| Power | 1M | $35 | $15-25 | $5.63 | $5.63 |

*Note: Cost ranges account for varying input/output ratios. Output tokens are more expensive.*

### Profit Margins

| Package | GPT-5 / Gemini 2.5 Pro | Claude Opus 4.5 |
|---------|------------------------|-----------------|
| Starter | ~$4.44 (89% margin) | $2.50-3.50 (50-70% margin) |
| Booster | ~$17.19 (86% margin) | $7.50-12.50 (37-62% margin) |
| Power | ~$29.37 (84% margin) | $10-20 (29-57% margin) |

## Recommendations

### Option 1: Current Pricing (Conservative)
Keep current pricing. Works well for GPT-5 and Gemini. Tight margins on Claude Opus 4.5.

### Option 2: Model-Based Routing
- Default users to GPT-5 or Gemini 2.5 Pro (high margin)
- Offer Claude Opus 4.5 as premium option with higher token cost
- Apply 2x multiplier for Opus usage

### Option 3: Increase Prices for Premium Models
If offering Claude Opus 4.5 as default:

| Package | Tokens | Current Price | Suggested Price |
|---------|--------|---------------|-----------------|
| Starter | 100K | $5 | $10 |
| Booster | 500K | $20 | $40 |
| Power | 1M | $35 | $70 |

### Option 4: Output Token Multiplier
Count output tokens at 3-5x input tokens (reflects actual cost difference).

## Typical User Token Usage Patterns

### Per Message/Query

| Task Type | Input Tokens | Output Tokens | Total per Query |
|-----------|--------------|---------------|-----------------|
| Simple chat message | ~10-50 | ~100-200 | ~150-250 |
| Short Q&A | ~50-100 | ~200-500 | ~300-600 |
| Detailed question w/ paragraph answer | ~100-500 | ~500-1,500 | ~1,000-2,000 |
| Complex task (summarization, analysis) | ~500-2,000 | ~1,000-3,000 | ~2,000-5,000 |
| Code generation/review | ~500-2,000 | ~1,000-4,000 | ~2,000-6,000 |
| Long conversation (6-7 messages) | ~80-100 | ~600-1,000 | ~700-1,100 |

### Monthly Usage Estimates

| User Type | Estimated Monthly Usage | Token Pack Needed |
|-----------|------------------------|-------------------|
| Casual user (few queries/day) | ~10,000-30,000 tokens | Starter (100K) lasts 3-10 months |
| Regular user (~1 hr/day) | ~100,000 tokens | Starter (100K) lasts ~1 month |
| Power user (heavy daily use) | ~300,000-500,000 tokens | Booster (500K) lasts ~1 month |
| Professional/Developer | ~500,000-1,000,000 tokens | Power (1M) lasts ~1 month |

### Key Insights

1. **Output tokens dominate costs**: AI responses are typically 3-4x longer than user inputs
2. **Context accumulation**: Longer conversations use exponentially more tokens as chat history grows
3. **Simple chatbot interactions**: ~10 input / ~113 output tokens per message average
4. **Heavy users**: Claude Code developers average ~$6/day (~$100-200/month)
5. **Hourly usage benchmark**: 1 hour of active ChatGPT use ≈ ~3,000-5,000 tokens

### What Users Can Do With Each Package

| Package | Tokens | Simple Chats | Detailed Q&As | Code Tasks |
|---------|--------|--------------|---------------|------------|
| Starter | 100K | ~400-650 | ~50-100 | ~15-50 |
| Booster | 500K | ~2,000-3,300 | ~250-500 | ~80-250 |
| Power | 1M | ~4,000-6,600 | ~500-1,000 | ~165-500 |

## Sources

- [Claude Opus 4.5 Pricing](https://www.anthropic.com/claude/opus)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [OpenAI Token Usage Guide](https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them)
- [Claude Token Limits Guide](https://www.arsturn.com/blog/mastering-claudes-token-limits-a-beginners-guide)
- [AI Chatbot API Cost Analysis](https://mongoosemedia.us/cost-to-connect-api-with-ai-chatbot)

---

*Last updated: December 2025*
