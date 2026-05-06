
import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"
import { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      firstName: string
      lastName: string
      phone?: string
      isActive: boolean
      patient?: any
      dentist?: any
      staff?: any
      patientId?: string
      dentistId?: string
      staffId?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: UserRole
    firstName: string
    lastName: string
    phone?: string
    isActive: boolean
    patient?: any
    dentist?: any
    staff?: any
    patientId?: string
    dentistId?: string
    staffId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: UserRole
    firstName: string
    lastName: string
    phone?: string
    isActive: boolean
    patient?: any
    dentist?: any
    staff?: any
    patientId?: string
    dentistId?: string
    staffId?: string
  }
}
