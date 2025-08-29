// reCAPTCHA utility functions

export interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('RECAPTCHA_SECRET_KEY not configured');
    return true; // Allow through if not configured (for development)
  }

  if (!token) {
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', process.env.RECAPTCHA_SECRET_KEY);
    params.append('response', token);
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!response.ok) {
      console.error('reCAPTCHA API error:', response.status);
      return false;
    }
    
    const responseText = await response.text();
    const data: RecaptchaResponse = JSON.parse(responseText);
    
    if (data.success) {
      return true;
    }

    // Log errors for debugging but less verbose
    if (process.env.NODE_ENV === 'development') {
      console.log('reCAPTCHA verification failed:', data['error-codes']);
    }
    return false;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return false;
  }
}

export function getRecaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
}