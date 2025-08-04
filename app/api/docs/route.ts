import { NextRequest, NextResponse } from 'next/server';
import { swaggerSpec, createSwaggerUI } from '@/lib/swagger';

export async function GET(req: NextRequest) {
  // Return Swagger UI HTML
  const html = createSwaggerUI('/api/openapi.json');

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}