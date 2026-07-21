# Production email login requires reCAPTCHA

In production, email/password login must verify reCAPTCHA server-side. If `RECAPTCHA_SECRET_KEY` is missing in production, refuse login (fail closed)—do not allow requests through. Development may skip reCAPTCHA. In-process rate limits remain complementary, not a substitute.
