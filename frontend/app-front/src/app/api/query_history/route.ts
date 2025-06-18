import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '10'
    
    // Forward the request to the FastAPI backend
    const backendUrl = `http://localhost:8000/query_history?limit=${limit}`
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch query history' },
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