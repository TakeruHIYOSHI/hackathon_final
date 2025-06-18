import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const cookies = request.cookies
    const sessionId = cookies.get('session_id')?.value
    
    // Call the FastAPI backend logout endpoint
    const backendUrl = 'http://localhost:8000/logout'
    const headers: HeadersInit = {}
    
    // Forward the session cookie to backend if it exists
    if (sessionId) {
      headers['Cookie'] = `session_id=${sessionId}`
    }
    
    // Call backend logout
    await fetch(backendUrl, {
      method: 'GET',
      headers
    })
    
    // Create response that redirects to home page
    const response = NextResponse.redirect(new URL('/', request.url))
    
    // Delete the session cookie on client side
    response.cookies.delete('session_id')
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    // Even if backend call fails, still redirect and clear cookies
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete('session_id')
    return response
  }
} 