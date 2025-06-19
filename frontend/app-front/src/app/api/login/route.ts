import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Redirect to the FastAPI backend login endpoint
    const backendUrl = 'https://gmail-hackathon-633399924693.us-central1.run.app/login'
    
    return NextResponse.redirect(backendUrl)
  } catch (error) {
    console.error('Login redirect error:', error)
    return NextResponse.json(
      { error: 'Login redirect failed' },
      { status: 500 }
    )
  }
} 