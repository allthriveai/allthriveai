"""
Tests for avatar reference image URL validation (SSRF protection).

These tests ensure that the is_safe_url function correctly validates
URLs against the allowed domains list, preventing SSRF attacks while
allowing legitimate S3 URLs from production.
"""

from django.test import TestCase

from core.avatars.views import ALLOWED_IMAGE_DOMAINS, is_safe_url


class AllowedImageDomainsTests(TestCase):
    """Test that ALLOWED_IMAGE_DOMAINS contains expected entries."""

    def test_contains_localhost_for_dev(self):
        """Local development should work."""
        self.assertIn('localhost', ALLOWED_IMAGE_DOMAINS)
        self.assertIn('127.0.0.1', ALLOWED_IMAGE_DOMAINS)

    def test_contains_minio_for_docker(self):
        """Docker MinIO should work."""
        self.assertIn('minio', ALLOWED_IMAGE_DOMAINS)

    def test_contains_production_s3_region(self):
        """Production S3 region (us-east-1) should be allowed."""
        self.assertIn('s3.us-east-1.amazonaws.com', ALLOWED_IMAGE_DOMAINS)


class IsSafeUrlTests(TestCase):
    """Test is_safe_url function for SSRF prevention."""

    # === Production S3 URLs (MUST PASS) ===

    def test_production_s3_url_format(self):
        """Production S3 URLs should be allowed.

        This is the actual URL format returned by our storage service in production.
        Regression test for the bug where us-west-2 was hardcoded instead of us-east-1.
        """
        url = 'https://s3.us-east-1.amazonaws.com/allthrive-media-production-123456/public/avatar-references/user_2/image.png'
        self.assertTrue(is_safe_url(url))

    def test_production_s3_private_file(self):
        """Private S3 files should also work."""
        url = 'https://s3.us-east-1.amazonaws.com/allthrive-media-production-123456/private/uploads/file.jpg'
        self.assertTrue(is_safe_url(url))

    # === Local Development URLs (MUST PASS) ===

    def test_localhost_minio_url(self):
        """Local MinIO URLs should be allowed."""
        url = 'http://localhost:9000/media/public/avatar-references/user_1/test.png'
        self.assertTrue(is_safe_url(url))

    def test_minio_docker_url(self):
        """Docker internal MinIO URLs should be allowed."""
        url = 'http://minio:9000/media/public/uploads/image.jpg'
        self.assertTrue(is_safe_url(url))

    def test_127_0_0_1_url(self):
        """127.0.0.1 URLs should be allowed."""
        url = 'http://127.0.0.1:9000/bucket/file.png'
        self.assertTrue(is_safe_url(url))

    # === Generic S3 URLs (MUST PASS) ===

    def test_generic_s3_amazonaws_url(self):
        """Generic s3.amazonaws.com should be allowed."""
        url = 'https://s3.amazonaws.com/some-bucket/file.png'
        self.assertTrue(is_safe_url(url))

    def test_google_cloud_storage_url(self):
        """Google Cloud Storage should be allowed."""
        url = 'https://storage.googleapis.com/bucket/file.png'
        self.assertTrue(is_safe_url(url))

    # === Empty/None URLs (MUST PASS - no URL means no reference image) ===

    def test_empty_string_is_safe(self):
        """Empty string means no reference image - should be allowed."""
        self.assertTrue(is_safe_url(''))

    def test_none_is_safe(self):
        """None means no reference image - should be allowed."""
        self.assertTrue(is_safe_url(None))

    # === SSRF Attack Vectors (MUST FAIL) ===

    def test_rejects_internal_ip_169_254(self):
        """AWS metadata endpoint should be blocked."""
        url = 'http://169.254.169.254/latest/meta-data/'
        self.assertFalse(is_safe_url(url))

    def test_rejects_internal_ip_10_x(self):
        """Internal 10.x.x.x IPs should be blocked."""
        url = 'http://10.0.0.1/secret'
        self.assertFalse(is_safe_url(url))

    def test_rejects_internal_ip_192_168(self):
        """Internal 192.168.x.x IPs should be blocked."""
        url = 'http://192.168.1.1/admin'
        self.assertFalse(is_safe_url(url))

    def test_rejects_arbitrary_domain(self):
        """Random domains should be blocked."""
        url = 'https://evil.com/malware.exe'
        self.assertFalse(is_safe_url(url))

    def test_rejects_malicious_subdomain_trick(self):
        """Domains that end with allowed domain but aren't subdomains should be blocked.

        evil-s3.amazonaws.com is NOT a subdomain of s3.amazonaws.com.
        """
        url = 'https://malicious-s3.amazonaws.com/bucket/file.png'
        self.assertFalse(is_safe_url(url))

    def test_rejects_localhost_in_path_trick(self):
        """URLs that try to trick with localhost in the path should be blocked."""
        url = 'http://evil.com/localhost/file.png'
        self.assertFalse(is_safe_url(url))

    def test_rejects_file_protocol(self):
        """file:// protocol should be blocked."""
        url = 'file:///etc/passwd'
        self.assertFalse(is_safe_url(url))

    def test_rejects_ftp_protocol(self):
        """ftp:// protocol should be blocked."""
        url = 'ftp://ftp.evil.com/file.txt'
        self.assertFalse(is_safe_url(url))

    def test_rejects_data_uri(self):
        """data: URIs should be blocked."""
        url = 'data:image/png;base64,iVBORw0KGgo...'
        self.assertFalse(is_safe_url(url))

    # === Valid Subdomain Cases (MUST PASS) ===

    def test_allows_valid_subdomain_of_s3(self):
        """Valid subdomains of allowed domains should work."""
        url = 'https://cdn.s3.amazonaws.com/file.png'
        self.assertTrue(is_safe_url(url))

    def test_allows_deep_subdomain(self):
        """Deep subdomains should work if parent is allowed."""
        url = 'https://a.b.c.storage.googleapis.com/file.png'
        self.assertTrue(is_safe_url(url))

    # === Edge Cases ===

    def test_handles_malformed_url(self):
        """Malformed URLs should be rejected safely."""
        url = 'not-a-valid-url'
        self.assertFalse(is_safe_url(url))

    def test_handles_url_without_scheme(self):
        """URLs without scheme should be rejected."""
        url = '//s3.amazonaws.com/bucket/file.png'
        self.assertFalse(is_safe_url(url))

    def test_case_insensitive_domain_matching(self):
        """Domain matching should be case-insensitive."""
        url = 'https://S3.US-EAST-1.AMAZONAWS.COM/bucket/file.png'
        self.assertTrue(is_safe_url(url))
