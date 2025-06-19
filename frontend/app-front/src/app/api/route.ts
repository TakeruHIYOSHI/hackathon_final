import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    console.log('=== Root API Route Debug ===')
    console.log('Cookie header received:', cookieHeader)
    
    // Forward the request to the FastAPI backend root endpoint
    const backendUrl = 'https://gmail-hackathon-633399924693.us-central1.run.app/'
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'NextJS-API-Route',
        'Origin': request.headers.get('origin') || 'https://hackathon-final-zunz.vercel.app',
        'Referer': request.headers.get('referer') || 'https://hackathon-final-zunz.vercel.app',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend not available' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Forward any Set-Cookie headers from the backend
    const setCookieHeaders = response.headers.get('set-cookie')
    const responseHeaders: HeadersInit = {
      'Content-Type': 'application/json; charset=utf-8',
    }
    
    if (setCookieHeaders) {
      responseHeaders['Set-Cookie'] = setCookieHeaders
    }
    
    // Return the response from the backend
    return NextResponse.json(data, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 