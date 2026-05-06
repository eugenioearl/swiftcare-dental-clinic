import { redirect } from 'next/navigation'

export default function DentistPatientsRedirect() {
  redirect('/admin/patients')
}
