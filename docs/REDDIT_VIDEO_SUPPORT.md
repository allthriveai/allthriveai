# Reddit Video Support

## Overview

Reddit posts that contain videos are now fully supported! Videos are automatically detected, extracted, and displayed on project pages.

## How It Works

### Backend (Already Implemented ✅)

The Reddit sync service already extracts video data from Reddit's JSON API:

1. **Detection**: Checks `is_video` flag in Reddit post data
2. **Extraction**: Gets video URL from `secure_media.reddit_video.fallback_url`
3. **Storage**: Stores in `reddit_metadata` JSON field on `RedditThread` model
4. **API**: Exposes via project serializer as `content.reddit.video_url` and `content.reddit.is_video`

**Relevant Code:**
- `services/reddit_sync_service.py` (lines 254-261) - Video extraction
- `core/projects/serializers.py` (lines 230-232) - API serialization

### Frontend (Just Added ✅)

The `RedditThreadLayout` component now renders videos:

**Changes Made:**
1. Extract video data from `redditData` object
2. Check `hasVideo` flag and `postVideoUrl`
3. Render HTML5 `<video>` element when video is available
4. Fallback to thumbnail image if no video

**Code Location:**
- `frontend/src/components/projects/reddit/RedditThreadLayout.tsx`

## Video Display

### Video Player Features

```tsx
<video
  controls          // Show play/pause, volume, timeline controls
  className="w-full max-h-[800px] object-contain"
  preload="metadata" // Load video metadata but not full video
  playsInline       // Play inline on mobile (don't go fullscreen)
>
  <source src={videoUrl} type="video/mp4" />
  Your browser does not support the video tag.
</video>
```

### Display Priority

1. **Video** - If `is_video === true` and `video_url` exists
2. **Image** - If thumbnail image available
3. **None** - If neither available

## Data Flow

```
Reddit Post
    ↓
Reddit JSON API (/post.json)
    ↓
RedditSyncService.fetch_post_metrics()
    ↓
reddit_metadata.video_url
reddit_metadata.is_video
    ↓
ProjectSerializer (content.reddit.video_url)
    ↓
Frontend API Response
    ↓
RedditThreadLayout component
    ↓
HTML5 <video> element
```

## Example API Response

```json
{
  "id": 123,
  "type": "reddit_thread",
  "title": "My guy has a good point",
  "content": {
    "reddit": {
      "subreddit": "ChatGPT",
      "author": "username",
      "permalink": "https://reddit.com/r/ChatGPT/comments/...",
      "is_video": true,
      "video_url": "https://v.redd.it/abc123/DASH_720.mp4",
      "video_duration": 45,
      "thumbnail_url": "https://...",
      "score": 1234,
      "num_comments": 56
    }
  }
}
```

## Supported Video Formats

- **Reddit Hosted Videos**: `v.redd.it` domain (most common)
- **Format**: MP4 (DASH stream fallback URL)
- **Mobile**: Full support with `playsInline` attribute

## Browser Compatibility

The HTML5 `<video>` element is supported in:
- ✅ Chrome/Edge (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (desktop and mobile)
- ✅ Opera
- ✅ Mobile browsers (iOS Safari, Android Chrome)

## Testing

### Example Reddit Video Posts

Test with these types of posts:
1. Native Reddit video uploads
2. v.redd.it hosted videos
3. Posts with both video and images (gallery)

### Verification

1. Navigate to a Reddit thread project (e.g., `http://localhost:3000/chatgpt-reddit-bot/my-guy-has-a-good-point`)
2. Check browser console for debug logs:
   ```
   RedditThreadLayout - is_video: true
   RedditThreadLayout - video_url: https://v.redd.it/...
   ```
3. Verify video player appears with controls
4. Click play to ensure video loads and plays

## Known Limitations

1. **Audio Issues**: Some Reddit videos have separate audio tracks (DASH format). The `fallback_url` includes audio, but quality may vary.
2. **External Videos**: YouTube, TikTok, and other embedded videos are not supported (shows link only)
3. **Live Streams**: Reddit live videos are not supported

## Future Enhancements

- [ ] Support for external video embeds (YouTube, Vimeo, etc.)
- [ ] Video thumbnail generation for preview
- [ ] Video download option
- [ ] Playback speed controls
- [ ] Picture-in-picture mode
- [ ] Auto-play with mute option
- [ ] Video quality selector (if multiple resolutions available)

## Troubleshooting

### Video Not Displaying

**Issue**: Video URL exists but player not showing
- **Check**: Browser console for video URL
- **Check**: Network tab to see if video loads
- **Fix**: Clear cache and reload

### Video Won't Play

**Issue**: Player shows but video doesn't play
- **Cause**: Reddit video URL may be expired or region-restricted
- **Fix**: Visit original Reddit post to verify video works there

### No Video Data

**Issue**: `is_video: false` even though Reddit post has video
- **Cause**: Reddit may not expose video in RSS feed
- **Fix**: Video data is fetched from JSON API during sync, ensure sync ran successfully

## Related Files

**Backend:**
- `services/reddit_sync_service.py` - Video extraction logic
- `core/integrations/reddit_models.py` - Data storage
- `core/projects/serializers.py` - API serialization

**Frontend:**
- `frontend/src/components/projects/reddit/RedditThreadLayout.tsx` - Video rendering
- `frontend/src/types/models.ts` - TypeScript types

## Migration Notes

No migration required - video support works automatically for:
- ✅ New Reddit posts synced after this update
- ✅ Existing Reddit posts (video data already in `reddit_metadata`)

Simply refresh the frontend to see videos on existing posts!
