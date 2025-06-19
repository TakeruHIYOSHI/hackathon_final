import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body
    
    console.log('=== Establish Session API Route Debug ===')
    console.log('Received session_id:', session_id)
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      )
    }
    
    // Create response with session cookie
    const response = NextResponse.json(
      { 
        message: 'Session established successfully',
        session_id: session_id
      },
      { status: 200 }
    )
    
    // Set the session cookie
    response.cookies.set({
      name: 'session_id',
      value: session_id,
      httpOnly: true,
      secure: true, // Always true for production
      sameSite: 'none', // Required for cross-origin
      maxAge: 3600, // 1 hour
      path: '/'
    })
    
    console.log('Session cookie set:', session_id)
    
    return response
  } catch (error) {
    console.error('Establish session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 