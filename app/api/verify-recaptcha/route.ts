import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptcha } from '../../../lib/recaptcha';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'reCAPTCHA token is required' }, { status: 400 });
    }

    const isValid = await verifyRecaptcha(token);

    if (!isValid) {
      return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('reCAPTCHA API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 });
  }
}