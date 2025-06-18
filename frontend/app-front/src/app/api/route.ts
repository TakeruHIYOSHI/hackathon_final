import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Forward the request to the FastAPI backend root endpoint
    const backendUrl = 'http://localhost:8000/'
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend not available' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return the response from the backend
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 