# Creator Marketplace Plan

## Overview

Build a full-featured creator marketplace where users can sell courses, digital prompts, templates, and ebooks. Features include a complete course builder with video hosting, freemium access model, AI-powered content creation, and integrated discovery.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Content model | Migrate from JSON to relational models (CourseModule, CourseLesson) |
| Freemium | Free preview lessons + paid full access |
| Product types | All types equal: courses, prompts, templates, ebooks |
| Course creation | Full course builder with modules, lessons, quizzes, video upload |
| Video hosting | Full platform with transcoding, adaptive streaming |
| Library UX | Unified - purchased content merges into Learn page |
| Creator AI allowance | Very generous (1M+ tokens/month) |

---

## Phase 1: Data Architecture & Models

### 1.1 New Course Content Models

Add to `core/marketplace/models.py`:

```python
class CourseModule(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='modules')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_free_preview = models.BooleanField(default=False, db_index=True)
    estimated_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product', 'order']
        unique_together = ['product', 'order']


class CourseLesson(models.Model):
    CONTENT_TYPES = [
        ('text', 'Text/Article'),
        ('video', 'Video'),
        ('video_embed', 'External Embed'),
        ('quiz_inline', 'Inline Quiz'),
        ('exercise', 'Exercise'),
    ]

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, default='text')
    content = models.TextField(help_text='Markdown content')

    # Video fields
    video_asset = models.ForeignKey('VideoAsset', null=True, blank=True, on_delete=models.SET_NULL)
    video_url = models.URLField(blank=True)  # External embed

    # Metadata
    key_takeaways = models.JSONField(default=list)
    order = models.PositiveIntegerField(default=0)
    estimated_minutes = models.PositiveIntegerField(default=5)
    is_free_preview = models.BooleanField(default=False, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['module', 'order']
        unique_together = ['module', 'order']


class CourseQuiz(models.Model):
    QUIZ_TYPES = [('module', 'End of Module'), ('course', 'Final Assessment'), ('inline', 'Inline')]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='course_quizzes')
    module = models.ForeignKey(CourseModule, null=True, blank=True, on_delete=models.CASCADE)
    lesson = models.ForeignKey(CourseLesson, null=True, blank=True, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    quiz_type = models.CharField(max_length=20, choices=QUIZ_TYPES, default='module')
    passing_score = models.PositiveIntegerField(default=70)
    allow_retakes = models.BooleanField(default=True)
    is_free_preview = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)


class CourseQuizQuestion(models.Model):
    QUESTION_TYPES = [('multiple_choice', 'Multiple Choice'), ('true_false', 'True/False'), ('multi_select', 'Multi Select')]

    quiz = models.ForeignKey(CourseQuiz, on_delete=models.CASCADE, related_name='questions')
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES, default='multiple_choice')
    question_text = models.TextField()
    options = models.JSONField(default=list)
    correct_answer = models.JSONField()  # Index or list of indexes
    explanation = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
```

### 1.2 Video Hosting Models

Add to `core/marketplace/models.py`:

```python
class VideoAsset(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Upload'),
        ('uploading', 'Uploading'),
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='video_assets')
    title = models.CharField(max_length=255)

    # Source file
    original_file = models.CharField(max_length=500)  # S3 key
    original_size_bytes = models.BigIntegerField(default=0)

    # Transcoded versions
    hls_playlist_url = models.URLField(blank=True)  # m3u8 master playlist
    thumbnail_url = models.URLField(blank=True)

    # Metadata
    duration_seconds = models.PositiveIntegerField(null=True)
    width = models.PositiveIntegerField(null=True)
    height = models.PositiveIntegerField(null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    processing_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True)


class VideoQualityVariant(models.Model):
    video = models.ForeignKey(VideoAsset, on_delete=models.CASCADE, related_name='variants')
    quality = models.CharField(max_length=20)  # 1080p, 720p, 480p, 360p
    bitrate = models.PositiveIntegerField()  # kbps
    file_path = models.CharField(max_length=500)  # S3 key
    file_size_bytes = models.BigIntegerField()
```

### 1.3 Progress Tracking Models

```python
class UserCourseEnrollment(models.Model):
    ACCESS_TYPES = [('purchased', 'Purchased'), ('gifted', 'Gifted'), ('promotional', 'Promo'), ('preview', 'Preview Only')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_enrollments')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='enrollments')
    product_access = models.ForeignKey(ProductAccess, null=True, on_delete=models.SET_NULL)
    access_type = models.CharField(max_length=20, choices=ACCESS_TYPES, default='purchased')

    # Denormalized progress
    lessons_completed = models.PositiveIntegerField(default=0)
    total_lessons = models.PositiveIntegerField(default=0)
    progress_percentage = models.FloatField(default=0.0)
    total_time_spent_seconds = models.PositiveIntegerField(default=0)

    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True)
    certificate_issued = models.BooleanField(default=False)

    enrolled_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'product']


class UserLessonProgress(models.Model):
    enrollment = models.ForeignKey(UserCourseEnrollment, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson = models.ForeignKey(CourseLesson, on_delete=models.CASCADE)

    is_completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    video_progress_seconds = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)
    is_bookmarked = models.BooleanField(default=False)

    first_viewed_at = models.DateTimeField(auto_now_add=True)
    last_viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['enrollment', 'lesson']


class UserQuizAttempt(models.Model):
    enrollment = models.ForeignKey(UserCourseEnrollment, on_delete=models.CASCADE, related_name='quiz_attempts')
    quiz = models.ForeignKey(CourseQuiz, on_delete=models.CASCADE)
    attempt_number = models.PositiveIntegerField(default=1)
    answers = models.JSONField(default=dict)
    score = models.PositiveIntegerField(default=0)
    percentage_score = models.FloatField(default=0.0)
    is_passed = models.BooleanField(default=False, db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
```

### 1.4 Creator AI Allowance

Add to `CreatorAccount` model:

```python
# Add to existing CreatorAccount model
ai_allowance_tokens = models.IntegerField(default=1_000_000)  # 1M tokens/month
ai_tokens_used = models.IntegerField(default=0)
ai_allowance_reset_date = models.DateField(null=True)
ai_allowance_tier = models.CharField(
    max_length=20,
    choices=[('starter', 'Starter 1M/mo'), ('pro', 'Pro 5M/mo'), ('unlimited', 'Unlimited')],
    default='starter',
)
```

### 1.5 Product Model Updates

Add to existing `Product` model:

```python
# Additional fields for Product
total_duration_minutes = models.PositiveIntegerField(null=True)
total_lessons = models.PositiveIntegerField(null=True)
total_modules = models.PositiveIntegerField(null=True)
has_free_preview = models.BooleanField(default=False, db_index=True)
free_preview_lesson_count = models.PositiveIntegerField(default=0)
learning_outcomes = models.JSONField(default=list)
prerequisites = models.JSONField(default=list)

# Pricing options
compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
pricing_type = models.CharField(
    max_length=20,
    choices=[('fixed', 'Fixed'), ('free', 'Free'), ('pwyw', 'Pay What You Want')],
    default='fixed',
)
```

---

## Phase 2: Video Processing Infrastructure

### 2.1 Video Upload Service

Create `core/marketplace/services/video.py`:

```python
class VideoUploadService:
    """Handle video uploads with presigned URLs and S3."""

    def create_upload_session(self, user, filename, content_type, size_bytes) -> dict:
        """Generate presigned URL for direct S3 upload."""
        # Create VideoAsset record
        # Generate presigned POST URL
        # Return upload URL and asset ID

    def complete_upload(self, asset_id) -> VideoAsset:
        """Mark upload complete and trigger processing."""
        # Update status to 'processing'
        # Queue Celery task for transcoding

    def get_playback_url(self, asset_id, user) -> str:
        """Get signed HLS playlist URL for playback."""
```

### 2.2 Video Processing Pipeline (Celery)

Create `core/marketplace/tasks/video.py`:

```python
@shared_task
def process_video(asset_id: int):
    """Transcode video to HLS with multiple quality variants."""
    # 1. Download from S3 to temp
    # 2. Extract metadata (duration, resolution)
    # 3. Generate thumbnail
    # 4. Transcode to HLS (360p, 480p, 720p, 1080p)
    # 5. Upload variants to S3
    # 6. Update VideoAsset status to 'ready'
```

### 2.3 AWS MediaConvert Integration (Recommended)

For production, use AWS MediaConvert instead of FFmpeg:
- Create MediaConvert job template for HLS output
- Use S3 event notification to trigger Lambda
- Store outputs in S3 with CloudFront distribution

---

## Phase 3: Course Builder

### 3.1 Course Builder API Endpoints

Add to `ProductViewSet`:

```python
# Module management
@action(detail=True, methods=['post'])
def add_module(self, request, pk=None):
    """Add a new module to the course."""

@action(detail=True, methods=['patch'], url_path='modules/(?P<module_id>\\d+)')
def update_module(self, request, pk=None, module_id=None):
    """Update module details."""

@action(detail=True, methods=['delete'], url_path='modules/(?P<module_id>\\d+)')
def delete_module(self, request, pk=None, module_id=None):
    """Delete a module."""

@action(detail=True, methods=['post'])
def reorder_modules(self, request, pk=None):
    """Reorder modules."""

# Lesson management
@action(detail=True, methods=['post'], url_path='modules/(?P<module_id>\\d+)/lessons')
def add_lesson(self, request, pk=None, module_id=None):
    """Add lesson to module."""

@action(detail=True, methods=['patch'], url_path='lessons/(?P<lesson_id>\\d+)')
def update_lesson(self, request, pk=None, lesson_id=None):
    """Update lesson content."""

@action(detail=True, methods=['post'], url_path='lessons/(?P<lesson_id>\\d+)/upload-video')
def upload_lesson_video(self, request, pk=None, lesson_id=None):
    """Get presigned URL for video upload."""

# AI assistance
@action(detail=True, methods=['post'])
def ai_generate_outline(self, request, pk=None):
    """Generate course outline from topic/description using AI."""

@action(detail=True, methods=['post'], url_path='lessons/(?P<lesson_id>\\d+)/ai-enhance')
def ai_enhance_lesson(self, request, pk=None, lesson_id=None):
    """Enhance lesson content with AI."""

@action(detail=True, methods=['post'], url_path='modules/(?P<module_id>\\d+)/ai-generate-quiz')
def ai_generate_quiz(self, request, pk=None, module_id=None):
    """Generate quiz questions for module."""
```

### 3.2 Course Builder Frontend

New pages/components:
- `CourseBuilderPage.tsx` - Main course creation/editing interface
- `ModuleEditor.tsx` - Drag-and-drop module management
- `LessonEditor.tsx` - Rich text + video upload for lessons
- `QuizEditor.tsx` - Question builder with preview
- `VideoUploader.tsx` - Upload with progress, processing status
- `CoursePreview.tsx` - Preview as buyer would see

---

## Phase 4: Creator Experience

### 4.1 Creator AI Allowance Service

Create `core/marketplace/services/ai_allowance.py`:

```python
class CreatorAIAllowanceService:
    """Manage creator AI token allowances."""

    CREATOR_FEATURES = [
        'marketplace_course_generation',
        'marketplace_lesson_enhancement',
        'marketplace_quiz_generation',
        'marketplace_description_ai',
    ]

    @staticmethod
    def check_allowance(user, tokens_needed: int) -> tuple[bool, int]:
        """Check if creator has sufficient allowance."""
        account = CreatorAccount.objects.get(user=user)
        remaining = account.ai_allowance_tokens - account.ai_tokens_used
        return remaining >= tokens_needed, remaining

    @staticmethod
    def deduct_allowance(user, tokens_used: int, feature: str):
        """Deduct from creator allowance, fall back to user tokens if depleted."""
        account = CreatorAccount.objects.get(user=user)
        remaining = account.ai_allowance_tokens - account.ai_tokens_used

        if remaining >= tokens_used:
            # Use creator allowance
            account.ai_tokens_used = F('ai_tokens_used') + tokens_used
            account.save()
        else:
            # Use remaining allowance + user tokens
            if remaining > 0:
                account.ai_tokens_used = account.ai_allowance_tokens
                account.save()
            user_tokens_needed = tokens_used - remaining
            # Deduct from user's token balance
            CreditPackService.deduct_credits(user, user_tokens_needed)

    @staticmethod
    def reset_monthly_allowance():
        """Celery task: Reset allowances on monthly basis."""
        CreatorAccount.objects.filter(
            ai_allowance_reset_date__lte=timezone.now().date()
        ).update(
            ai_tokens_used=0,
            ai_allowance_reset_date=timezone.now().date() + timedelta(days=30)
        )
```

### 4.2 Creator Dashboard Enhancements

Extend `get_creator_dashboard_stats()`:

```python
def get_creator_dashboard_stats(user) -> dict:
    return {
        # Existing stats...
        'ai_allowance': {
            'tokens_remaining': remaining,
            'tokens_used': used,
            'tokens_total': total,
            'tier': tier,
            'resets_at': reset_date,
        },
        'products_by_type': {...},
        'revenue_trend': [...],  # Last 30 days
        'top_products': [...],
    }
```

---

## Phase 5: Buyer Experience & Discovery

### 5.1 Integrate Products into Explore

Modify `core/projects/views.py` explore endpoint:
- Include product fields when `Project.is_product=True`
- Add `price`, `product_type`, `has_access` to response
- Support `pricing` taxonomy filter (free/paid/freemium)

Add to `ProjectCardSerializer`:
```python
price = serializers.DecimalField(source='product.price', read_only=True)
product_type = serializers.CharField(source='product.product_type', read_only=True)
has_free_preview = serializers.BooleanField(source='product.has_free_preview', read_only=True)
user_has_access = serializers.SerializerMethodField()
```

### 5.2 Product Detail & Lesson Access

Create course access service `core/marketplace/services/access.py`:

```python
class CourseAccessService:
    @staticmethod
    def has_full_access(user, product: Product) -> bool:
        """Check if user has purchased/been granted full access."""
        if product.creator == user:
            return True
        return ProductAccess.objects.filter(
            user=user, product=product, is_active=True
        ).exists()

    @staticmethod
    def can_access_lesson(user, lesson: CourseLesson) -> bool:
        """Check if user can access specific lesson."""
        if lesson.is_free_preview or lesson.module.is_free_preview:
            return True
        return CourseAccessService.has_full_access(user, lesson.module.product)

    @staticmethod
    def get_lesson_access_map(user, product: Product) -> dict:
        """Return {lesson_id: {accessible: bool, reason: str}} for all lessons."""
```

### 5.3 Unified Library (Learn Page Integration)

Modify `LearnPage.tsx`:
- Add purchased products to the existing grid
- Use `CourseProgressCard` component for products
- Sort by `last_activity_at` to surface recent courses
- Show progress percentage on cards

API: Extend `/api/v1/marketplace/library/` to include progress data.

### 5.4 Product Detail Page

Create `frontend/src/pages/ProductDetailPage.tsx`:
- Course outline with module/lesson tree
- Lock icons on paid lessons
- Free preview playback
- Purchase CTA with price
- Creator info section
- Reviews section (future)

### 5.5 Lesson Player

Create `frontend/src/pages/LessonPlayerPage.tsx`:
- Video player (HLS.js for adaptive streaming)
- Lesson content (markdown rendered)
- Progress tracking (auto-save)
- Next/previous navigation
- Bookmark and notes

---

## Phase 6: Weaviate Integration

### 6.1 Add Products to Search

Update `services/search/unified_search.py`:

1. Add `is_product`, `product_type`, `price`, `has_free_preview` to Project schema
2. Index products during create/update
3. Add `product_type` to intent detection
4. Support `content_types=['product', 'course', 'prompt_pack']` filter

---

## Phase 7: Checkout & Payments

### 7.1 Free Product Flow

Add to `MarketplaceCheckoutService`:

```python
def checkout_free_product(self, user, product) -> ProductAccess:
    """Grant immediate access for free products."""
    if product.price > 0:
        raise ValidationError("Product is not free")

    access, created = ProductAccess.objects.get_or_create(
        user=user, product=product,
        defaults={'is_active': True, 'granted_at': timezone.now()}
    )

    # Create enrollment for courses
    if product.product_type == 'course':
        UserCourseEnrollment.objects.get_or_create(
            user=user, product=product, product_access=access,
            defaults={'access_type': 'purchased'}
        )

    return access
```

### 7.2 Post-Purchase Flow

On successful payment:
1. Create `ProductAccess` (existing)
2. Create `UserCourseEnrollment` for courses
3. Send confirmation email with access link
4. Redirect to product/first lesson

---

## Migration Strategy

### Data Migration: JSON → Relational

```python
def migrate_course_content(apps, schema_editor):
    """Migrate course content from Project.content JSON to models."""
    Product = apps.get_model('marketplace', 'Product')
    CourseModule = apps.get_model('marketplace', 'CourseModule')
    CourseLesson = apps.get_model('marketplace', 'CourseLesson')

    for product in Product.objects.filter(product_type='course'):
        content = product.project.content or {}
        course_data = content.get('course', {})

        for mod_idx, mod_data in enumerate(course_data.get('modules', [])):
            module = CourseModule.objects.create(
                product=product,
                title=mod_data.get('title', f'Module {mod_idx + 1}'),
                description=mod_data.get('description', ''),
                order=mod_idx,
                is_free_preview=(mod_idx == 0),  # First module free
            )

            for les_idx, les_data in enumerate(mod_data.get('lessons', [])):
                CourseLesson.objects.create(
                    module=module,
                    title=les_data.get('title', f'Lesson {les_idx + 1}'),
                    slug=f"lesson-{mod_idx + 1}-{les_idx + 1}",
                    content=les_data.get('content', ''),
                    key_takeaways=les_data.get('key_takeaways', []),
                    order=les_idx,
                    is_free_preview=(mod_idx == 0 and les_idx < 2),  # First 2 lessons free
                )
```

---

## Critical Files

### Backend
| File | Changes |
|------|---------|
| `core/marketplace/models.py` | Add CourseModule, CourseLesson, CourseQuiz, VideoAsset, progress tracking, RefundRequest models |
| `core/marketplace/services.py` | Add CourseAccessService, CreatorAIAllowanceService, VideoUploadService, RefundService |
| `core/marketplace/views.py` | Add course builder endpoints, video upload endpoints, refund endpoints |
| `core/marketplace/serializers.py` | Add serializers for new models |
| `core/marketplace/tasks/video.py` | Video processing Celery tasks |
| `core/projects/views.py` | Modify explore to include product data |
| `services/search/unified_search.py` | Add product fields to Weaviate schema |
| `core/billing/credit_pack_service.py` | Integrate with creator allowance |
| `core/community/models.py` | Add ProductRoom model linking products to community rooms |
| `core/community/services.py` | Extend to create product rooms, auto-add buyers |
| `core/marketplace/communication.py` | **NEW**: Creator inbox, blast messaging service |

### Frontend
| File | Changes |
|------|---------|
| `pages/ExplorePage.tsx` | Add product badges, pricing filter |
| `pages/LearnPage.tsx` | Add purchased products to unified library |
| `pages/ProductDetailPage.tsx` | New - Product landing page |
| `pages/LessonPlayerPage.tsx` | New - Lesson viewer with video |
| `pages/CourseBuilderPage.tsx` | New - Course creation interface |
| `components/marketplace/` | New - ModuleEditor, LessonEditor, VideoUploader, etc. |
| `components/projects/ProjectCard.tsx` | Add product price badge |
| `services/marketplace.ts` | New API service for marketplace |
| `types/marketplace.ts` | Update types for new models |

### Infrastructure
| Item | Requirement |
|------|-------------|
| AWS S3 | Video storage bucket |
| AWS MediaConvert | Video transcoding |
| AWS CloudFront | Video CDN distribution |
| Celery | Video processing queue |
| Redis | Already configured |

---

## Phased Rollout Strategy

### MILESTONE A: MVP - Digital Products + Pre-Built Courses
**Goal**: Launch marketplace with digital downloads and courses from YouTube import
**Duration**: 3-4 weeks
**Outcome**: Creators can sell prompts, templates, ebooks, and YouTube-imported courses

#### Week 1: Data Foundation + Digital Products
- [ ] Add Product model extensions (has_free_preview, pricing_type, etc.)
- [ ] Enhance ProductAsset for digital downloads (prompts, templates, ebooks)
- [ ] Create download delivery service (secure file URLs)
- [ ] Add free product checkout flow (price=$0)

#### Week 2: Discovery & Product Pages
- [ ] Modify Explore endpoint to include product data
- [ ] Add price badges to ProjectCard component
- [ ] Add product type filters to ExplorePage
- [ ] Create ProductDetailPage (description, assets, purchase CTA)
- [ ] Implement ProductCheckoutModal with Stripe

#### Week 3: Course Viewing (for pre-built courses)
- [ ] Add CourseModule, CourseLesson models
- [ ] Create migration for JSON → relational course content
- [ ] Add UserCourseEnrollment, UserLessonProgress models
- [ ] Create CourseAccessService (freemium logic)
- [ ] Build LessonViewerPage (text + video embeds)

#### Week 4: Library, AI Allowance, Refunds & Creator-Buyer Communication
- [ ] Integrate purchased products into LearnPage (unified library)
- [ ] Add CourseProgressCard component
- [ ] Add CreatorAccount AI allowance fields (1M tokens/month)
- [ ] Create CreatorAIAllowanceService
- [ ] **Add RefundRequest model and basic refund flow**
- [ ] **Create refund request endpoint (buyer can request)**
- [ ] **Creator refund approval/denial in dashboard**
- [ ] **Stripe refund integration**

**Creator-Buyer Communication** (leverages existing community infrastructure):
- [ ] **1:1 Private DMs**: Use existing DirectMessageThread - add "Message Creator" button on product page
- [ ] **Product Lounge Room**: Auto-create private Room per product, auto-add buyers on purchase
- [ ] **Blast Messages**: Creator can post announcements to product room (all buyers notified)
- [ ] **Creator inbox**: Dashboard view of all buyer conversations
- [ ] Test full purchase → access → room membership flow
- [ ] Bug fixes and polish

**MVP Deliverables**:
- ✅ **Digital products**: Prompts, templates, ebooks (downloadable files)
- ✅ **Pre-built courses**: From YouTube import (already exists)
- ✅ Products visible in Explore with price badges
- ✅ Free products: immediate access grant
- ✅ Paid products: Stripe checkout + access
- ✅ Freemium courses: free preview lessons + paid unlock
- ✅ Purchased content in unified Learn library
- ✅ Lesson viewer (text, YouTube/Vimeo embeds)
- ✅ Progress tracking (lesson completion %)
- ✅ Creator AI allowance (1M tokens/month)
- ✅ **Refund requests**: Buyer requests → Creator approves → Stripe processes
- ✅ **Creator-buyer communication**: 1:1 DMs, product lounge rooms, blast announcements

**What's NOT in MVP**:
- ❌ Course builder (creators use existing YouTube import)
- ❌ Native video upload/hosting
- ❌ Weaviate search for products
- ❌ Reviews, ratings, bundles, coupons

---

### MILESTONE B: Full Course Builder + Native Video
**Goal**: Creators can build courses from scratch with native video hosting
**Duration**: 6-8 weeks (after MVP)
**Outcome**: Complete course creation platform

#### Weeks 1-2: Video Infrastructure
- [ ] Create VideoAsset, VideoQualityVariant models
- [ ] Set up S3 bucket for video storage
- [ ] Implement VideoUploadService (presigned URLs)
- [ ] Set up AWS MediaConvert job template
- [ ] Create Celery task for transcoding pipeline
- [ ] Set up CloudFront distribution for video CDN

#### Weeks 3-4: Video Player & Integration
- [ ] Add HLS.js video player component
- [ ] Create VideoUploader component with progress
- [ ] Handle transcoding status polling
- [ ] Integrate video into lesson viewer

#### Weeks 5-6: Course Builder Frontend
- [ ] Create CourseBuilderPage
- [ ] Build ModuleEditor (drag-and-drop reordering)
- [ ] Build LessonEditor (rich text + video upload)
- [ ] Create QuizEditor (question builder)
- [ ] Add CoursePreview component

#### Weeks 7-8: AI Course Tools
- [ ] Add AI outline generation endpoint
- [ ] Add AI lesson enhancement endpoint
- [ ] Add AI quiz generation endpoint
- [ ] Polish and testing

**Phase B Deliverables**:
- ✅ Native video upload with 360p-1080p transcoding
- ✅ Adaptive streaming (HLS)
- ✅ Full course builder with modules/lessons/quizzes
- ✅ Drag-and-drop reordering
- ✅ AI-powered course outline and quiz generation

---

### MILESTONE C: Scale & Advanced Features
**Goal**: Search, analytics, and marketplace growth features
**Duration**: 4-6 weeks (after Phase B)
**Outcome**: Full-featured marketplace platform

#### Weeks 1-2: Search & Discovery
- [ ] Add products to Weaviate schema
- [ ] Index products on create/update
- [ ] Add product intent detection to search
- [ ] Enable product_type filter in unified search

#### Week 3: Creator Analytics
- [ ] Extend creator dashboard with detailed analytics
- [ ] Sales by day/week/month charts
- [ ] AI usage breakdown and costs saved
- [ ] Top products performance

#### Week 4: Reviews & Ratings
- [ ] Create ProductReview model
- [ ] Add review submission endpoint
- [ ] Display reviews on product page
- [ ] Calculate average rating

#### Weeks 5-6: Growth Features
- [ ] Coupon/discount code system
- [ ] Course bundles (multiple products)
- [ ] Completion certificates
- [ ] Email notifications (purchase, completion)

**Phase C Deliverables**:
- ✅ Products in Weaviate semantic search
- ✅ Creator analytics dashboard
- ✅ Product reviews and ratings
- ✅ Discount codes and promotions
- ✅ Course bundles
- ✅ Completion certificates

---

## Summary Table

| Milestone | Duration | Key Outcome | Dependencies |
|-----------|----------|-------------|--------------|
| **MVP (A)** | 3-4 weeks | Digital products + pre-built courses selling | None |
| **Phase B** | 6-8 weeks | Full course builder + native video hosting | MVP + AWS setup |
| **Phase C** | 4-6 weeks | Search, analytics, reviews, bundles | Phase B |

**Total**: 13-18 weeks for complete platform

**Recommendation**: Ship MVP with digital products + YouTube-imported courses first. Add course builder when creators ask for it.
