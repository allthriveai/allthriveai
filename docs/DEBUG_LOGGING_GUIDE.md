# GitHub Import Debug Logging Guide

**Date:** 2025-11-27
**Purpose:** Track down why hero images and project details might be empty

---

## Overview

Comprehensive debug logging has been added throughout the GitHub import flow to track:
1. AI analysis input and output
2. README parsing and image extraction
3. Hero image filtering (badges vs. real images)
4. Mermaid diagram generation
5. Final data being saved to database

---

## Debug Flow

### 1. GitHub Data Fetching
**File:** `core/integrations/github/views.py:219-226`

```
INFO  Importing GitHub repo owner/repo for user X
INFO  GitHub data fetch completed in X.XXs for owner/repo
DEBUG Normalizing GitHub data for owner/repo
DEBUG Normalized repo_summary: {...}
```

---

### 2. AI Analysis Start
**File:** `services/github_ai_analyzer.py:79-96`

```
INFO  🔍 Starting AI analysis for {name}
INFO  📝 Input - description: ...
INFO  🏷️  Input - language: X, stars: Y, topics: [...]
INFO  📄 Input - README length: X chars
DEBUG 📋 Full AI prompt: ...

INFO  ✅ AI response received for {name}, length: X chars
INFO  📨 AI raw response: {...}
```

**What to check:**
- Is the README being passed to AI? Check length
- What does the AI prompt contain?
- What does the AI raw response return?

---

### 3. AI Response Parsing
**File:** `services/github_ai_analyzer.py:100-139`

```
DEBUG AI parsed result keys: ['description', 'category_ids', ...]
INFO  AI analysis for {name}: X topics, Y categories
DEBUG Validated data: description_len=X, topics=[...], tools=[...]
```

**What to check:**
- Did AI return valid JSON?
- Does the response contain `description`, `category_ids`, `topics`?
- Are the values being validated correctly?

---

### 4. README Parsing
**File:** `services/readme_parser.py:52-161`

```
INFO  📖 Parsing README for {name}, length: X chars
DEBUG 🖼️  Found X total images in section "heading"
DEBUG    Image: https://... (alt: ...)
DEBUG    Added X individual image blocks
```

**What to check:**
- How many images were found in total?
- What are the image URLs?
- Are they being added as blocks?

---

### 5. Hero Image Extraction
**File:** `services/readme_parser.py:96-113`

```
DEBUG 🔍 Searching for hero image in X blocks from section "heading"
DEBUG    Checking image: https://... (is_badge: True/False)
INFO     ✨ Found hero image: https://...
DEBUG    ⏭️  Skipped badge image: https://...
DEBUG    ❌ No suitable hero image found in this section
```

**What to check:**
- Are images being checked?
- Is the badge detection working correctly?
- Is `is_badge` True for shields.io images?
- Was a hero image found, or were all images badges?

---

### 6. README Parser Final Result
**File:** `services/readme_parser.py:152-159`

```
INFO  📦 README Parser Final Result:
         - Total blocks: X
         - Hero image: https://... or None
         - Hero quote: ... or None
         - Mermaid diagrams: X
         - Demo URLs: X
```

**What to check:**
- Is hero_image None or a valid URL?
- How many blocks were created?
- Were any mermaid diagrams found in the README?

---

### 7. AI Diagram Generation (if no diagrams in README)
**File:** `services/readme_parser.py:336-401`

```
INFO  🎨 AI Diagram Generation Input:
         - Name: project-name
         - Description: ...
         - Language: Python
         - Topics: [...]
DEBUG 📋 AI Diagram Prompt: ...

INFO  ✅ AI diagram response received, length: X chars
INFO  📨 Raw AI diagram response: ...
DEBUG 🧹 Removed mermaid code fences
INFO  ✅ Valid Mermaid diagram generated for {name}
DEBUG Final diagram: graph TB ...
```

**What to check:**
- Was the AI called to generate a diagram?
- What input data was provided?
- What did the AI return?
- Did validation pass (starts with "graph TB/LR/TD/RL")?

---

### 8. AI Analysis Summary
**File:** `core/integrations/github/views.py:239-254`

```
INFO  🤖 Starting AI analysis for owner/repo...
INFO  ✅ AI analysis completed in X.XXs for owner/repo

INFO  📊 AI Analysis Summary for owner/repo:
         - Description length: X chars
         - Description: ...
         - Hero image: https://... or None
         - Hero quote: ... or None
         - Categories: [1, 9]
         - Topics: ['python', 'redis']
         - Tools: ['ChatGPT']
         - README blocks: X
         - Mermaid diagrams: X
         - Generated diagram: True/False
         - Demo URLs: X

DEBUG Full analysis content: {...}
```

**What to check:**
- Is the description empty or populated?
- Is hero_image None or a valid URL?
- How many README blocks were created?
- Were mermaid diagrams found or generated?

---

### 9. Project Creation Preview
**File:** `core/integrations/github/views.py:259-272`

```
INFO  🎨 Hero image from analysis: "https://..." (type: <class 'str'>)

INFO  💾 About to create project with data:
      {
        'title': 'project-name',
        'description': '...',
        'banner_url': '',
        'featured_image_url': 'https://...' or '',
        'readme_blocks_count': X,
        'mermaid_diagrams_count': X,
        'has_generated_diagram': True/False,
        'hero_quote': '...'
      }
```

**What to check:**
- Is `featured_image_url` empty or populated?
- Is `readme_blocks_count` > 0?
- Is `has_generated_diagram` True?

---

### 10. Final Saved Project
**File:** `core/integrations/github/views.py:326-339`

```
INFO  ✅ Successfully imported GitHub repo owner/repo as project X
         ⏱️  Timing: total=X.XXs, fetch=X.XXs, ai=X.XXs
         📊 Saved data:
            - Title: project-name
            - Description: ... or Empty
            - Banner: Empty (gradient)
            - Featured image: https://... or None
            - Content blocks: X
            - Mermaid diagrams: X
            - Generated diagram: True/False
            - Categories: X
            - Topics: X
```

**What to check:**
- Is Description "Empty" or populated?
- Is Featured image "None" or a URL?
- Are Content blocks > 0?
- Are Mermaid diagrams > 0 OR is Generated diagram True?

---

## Common Issues and What to Look For

### Issue: Empty Description
**Where to look:**
1. Check AI Analysis Summary → Description length
2. If 0, check AI raw response → Did AI return a description?
3. If AI didn't return one, check the AI prompt → Is README content included?

### Issue: No Hero Image
**Where to look:**
1. Check README Parser → How many images found?
2. Check Hero Image Extraction → Were all images marked as badges?
3. Check badge detection → Is `is_badge` correctly identifying shields.io?
4. Check Final hero_image → Is it None after all sections?

### Issue: No Mermaid Diagrams
**Where to look:**
1. Check README parsing → Were diagrams found in README?
2. If not, check AI Diagram Generation → Was AI called?
3. Check AI diagram response → What did AI return?
4. Check validation → Did the diagram start with "graph TB/LR"?

### Issue: Empty Project Details
**Where to look:**
1. Check AI Analysis Summary → All counts
2. Check README blocks count → Is it 0?
3. Check README Parser Final Result → Were blocks created?
4. Check AI raw response → Did AI analysis succeed?

---

## How to Read the Logs

### Step 1: Find the Import Request
Search for: `Importing GitHub repo {owner}/{repo}`

### Step 2: Follow the Flow
Look for these key markers in order:
1. 🔍 Starting AI analysis
2. 📖 Parsing README
3. 🖼️  Found X images
4. ✨ Found hero image (or ❌ No suitable hero image)
5. 📦 README Parser Final Result
6. 🎨 AI Diagram Generation (if needed)
7. 📊 AI Analysis Summary
8. 💾 About to create project
9. ✅ Successfully imported

### Step 3: Check Each Stage
At each stage, verify:
- Did the stage complete successfully?
- Are the expected values present?
- Are there any warnings or errors?

---

## Example Debug Session

```
INFO  Importing GitHub repo allierays/redis-wellness for user 1
INFO  GitHub data fetch completed in 2.34s

INFO  🔍 Starting AI analysis for redis-wellness
INFO  📄 Input - README length: 1234 chars
INFO  ✅ AI response received, length: 234 chars
INFO  📨 AI raw response: {"description": "A Redis-based...", ...}

INFO  📖 Parsing README for redis-wellness, length: 1234 chars
DEBUG 🖼️  Found 3 total images in section "Redis Wellness"
DEBUG    Image: https://img.shields.io/badge/... (alt: Build Status)
DEBUG    ⏭️  Skipped badge image: https://img.shields.io/...
DEBUG    Image: https://example.com/screenshot.png (alt: Screenshot)
INFO     ✨ Found hero image: https://example.com/screenshot.png

INFO  📦 README Parser Final Result:
         - Total blocks: 12
         - Hero image: https://example.com/screenshot.png
         - Mermaid diagrams: 0

INFO  🎨 No diagrams found in README, generating with AI...
INFO  ✅ AI diagram response received, length: 156 chars
INFO  ✅ Valid Mermaid diagram generated

INFO  📊 AI Analysis Summary:
         - Description length: 98 chars
         - Hero image: https://example.com/screenshot.png
         - README blocks: 12
         - Generated diagram: True

INFO  ✅ Successfully imported GitHub repo
         - Description: A Redis-based wellness tracking...
         - Featured image: https://example.com/screenshot.png
         - Content blocks: 12
         - Generated diagram: True
```

**Result:** Successful import with all data populated! ✅

---

## Troubleshooting Commands

### View logs in real-time
```bash
tail -f /path/to/django/logs | grep -E "🔍|📖|✨|🎨|📊|💾|✅"
```

### Search for specific repo import
```bash
grep "Importing GitHub repo owner/repo" /path/to/logs
```

### Check for errors
```bash
grep -E "ERROR|WARNING|❌" /path/to/logs
```

---

## Summary

With this comprehensive logging, you can now trace exactly:
- ✅ What data is being fetched from GitHub
- ✅ What the AI is receiving and returning
- ✅ What images are found and why they're included/excluded
- ✅ Whether diagrams are being generated successfully
- ✅ What data is being saved to the database

Try importing your **redis-wellness** repo again and follow the logs to see exactly where the process might be failing!
