import { cookies } from 'next/headers'
import { createSession, getSession } from './db'

const SESSION_COOKIE_NAME = 'categorizer_session'

export async function getOrCreateSession() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  
  if (sessionCookie?.value) {
    // Try to get existing session
    const session = await getSession(sessionCookie.value)
    if (session) {
      return session
    }
  }
  
  // Create new session
  const newSession = await createSession()
  cookieStore.set(SESSION_COOKIE_NAME, newSession.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  
  return newSession
}

export async function getCurrentSessionId() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  return sessionCookie?.value
}

export async function clearSession() {
  const cookieStore = cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
} 