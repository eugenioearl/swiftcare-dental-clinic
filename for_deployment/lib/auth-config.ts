
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  // Note: PrismaAdapter cannot be used with CredentialsProvider
  // adapter: PrismaAdapter(prisma), 
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              patient: true,
              dentist: true,
              staff: true
            }
          })

          if (!user) {
            return null
          }

          if (!user.isActive) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash)
          
          if (!isPasswordValid) {
            return null
          }

          // Update last login (in background)
          prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          }).catch(err => console.error('Failed to update last login:', err))

          // Log login action (in background)
          prisma.auditLog.create({
            data: {
              userId: user.id,
              entityType: 'user',
              entityId: user.id,
              action: 'login',
              newValues: { timestamp: new Date().toISOString() }
            }
          }).catch(err => console.error('Failed to create audit log:', err))

          return {
            id: user.id,
            email: user.email,
            name: `${user.lastName}, ${user.firstName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone || undefined,
            role: user.role,
            isActive: user.isActive,
            patient: user.patient,
            dentist: user.dentist,
            staff: user.staff,
            patientId: user.patient?.id,
            dentistId: user.dentist?.id,
            staffId: user.staff?.id
          } as any
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Refresh session every 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false
      }
    }
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist the OAuth access_token and or the user id to the token right after signin
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.phone = (user as any).phone
        token.isActive = (user as any).isActive
        token.patient = (user as any).patient
        token.dentist = (user as any).dentist
        token.staff = (user as any).staff
        token.patientId = (user as any).patientId
        token.dentistId = (user as any).dentistId
        token.staffId = (user as any).staffId
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a provider.
      if (session.user && token) {
        session.user.id = (token.id as string) || (token.sub as string)
        session.user.role = token.role as any
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        session.user.phone = token.phone as string
        session.user.isActive = token.isActive as boolean
        session.user.patient = token.patient as any
        session.user.dentist = token.dentist as any
        session.user.staff = token.staff as any
        session.user.patientId = token.patientId as string
        session.user.dentistId = token.dentistId as string
        session.user.staffId = token.staffId as string
      }
      return session
    }
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: false,
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in`)
    },
    async signOut({ token }) {
      console.log(`User signed out`)
    },
    async session({ session, token }) {
      // Session event is fired whenever a session is checked
      // console.log(`Session checked for user ${session?.user?.email}`)
    }
  },
}
