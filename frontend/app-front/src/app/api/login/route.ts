import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Redirect to the FastAPI backend login endpoint
    const backendUrl = 'http://localhost:8000/login'
    
    return NextResponse.redirect(backendUrl)
  } catch (error) {
    console.error('Login redirect error:', error)
    return NextResponse.json(
      { error: 'Login redirect failed' },
      { status: 500 }
    )
  }
} 