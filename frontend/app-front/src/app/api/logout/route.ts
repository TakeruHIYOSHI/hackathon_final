import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    
    console.log('=== Logout API Route Debug ===')
    console.log('Cookie header:', cookieHeader)
    
    // Forward the request to the FastAPI backend
    const backendUrl = 'https://gmail-hackathon-633399924693.us-central1.run.app/logout'
    
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
      redirect: 'manual' // Don't follow redirects automatically
    })

    console.log('Backend response status:', response.status)
    console.log('Backend response headers:', Object.fromEntries(response.headers.entries()))

    // Handle different response types
    if (response.status === 307 || response.status === 302) {
      // Backend returned a redirect - this is expected for logout
      console.log('Logout successful - backend returned redirect')
      
      // Create a redirect response to the frontend home page
      const frontendResponse = NextResponse.redirect(new URL('/', request.url))
      
      // Clear the session cookie on the frontend side as well
      frontendResponse.cookies.delete('session_id')
      
      return frontendResponse
    } else if (response.ok) {
      // Backend returned success without redirect
      const data = await response.json()
      console.log('Logout successful - backend returned JSON:', data)
      
      const frontendResponse = NextResponse.json({ message: 'Logged out successfully' })
      frontendResponse.cookies.delete('session_id')
      
      return frontendResponse
    } else {
      // Error response
      const errorText = await response.text()
      console.error('Backend logout error:', response.status, errorText)
      
      return NextResponse.json(
        { error: 'Logout failed' },
        { status: response.status }
      )
    }
  } catch (error) {
    console.error('Logout API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 