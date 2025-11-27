# OG Image Required

## What's Needed

A social media sharing image for Open Graph and Twitter Cards.

## Specifications

- **Filename:** `og-image.jpg`
- **Dimensions:** 1200px × 630px
- **Format:** JPG or PNG
- **File size:** Under 1MB recommended

## Design Requirements

The image should include:
1. **AllThrive AI logo** - prominently displayed
2. **Tagline:** "AI Portfolio Platform with Gamified Learning & Discovery"
3. **Visual elements** that represent:
   - AI/Technology theme
   - Portfolio/Project showcase
   - Learning/Education
   - Community/Collaboration
4. **Brand colors** from the design system
5. **High contrast** for readability when displayed small

## Design Inspiration

- Show a mockup of the platform interface
- Include icons representing the 3 pillars: Learn, Showcase, Connect
- Use gradient backgrounds matching brand colors
- Keep text minimal and highly readable

## Tools

- Figma (recommended)
- Canva
- Adobe Photoshop
- Any design tool that can export at exact dimensions

## Placement

Once created, place the file at:
```
frontend/public/og-image.jpg
```

The file is already referenced in:
- `frontend/index.html` meta tags
- `frontend/src/components/common/SEO.tsx`

## Testing

After creating the image, test it with:
1. Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
2. Twitter Card Validator: https://cards-dev.twitter.com/validator
3. LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

## Also Needed

A **logo.png** file for schema markup:
- Dimensions: Square (512px × 512px recommended)
- Format: PNG with transparency
- Location: `frontend/public/logo.png`

---

**Priority:** High  
**Status:** Pending Design  
**Assigned To:** Design Team
