import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    console.log('=== Query Emails API Route Debug ===')
    console.log('Cookie header received:', cookieHeader)
    
    // Get the request body
    const body = await request.json()
    
    // Forward the request to the FastAPI backend
    const backendUrl = 'https://gmail-hackathon-633399924693.us-central1.run.app/query_emails'
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        'User-Agent': request.headers.get('user-agent') || 'NextJS-API-Route',
        'Origin': request.headers.get('origin') || 'https://hackathon-final-zunz.vercel.app',
        'Referer': request.headers.get('referer') || 'https://hackathon-final-zunz.vercel.app',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    })

    console.log('Backend response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to query emails' },
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