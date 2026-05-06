/**
 * Calendar utility for generating iCal (.ics) files
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizerName: string;
  organizerEmail: string;
  attendeeName?: string;
  attendeeEmail?: string;
}

/**
 * Formats a date to iCal format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates an iCal (.ics) file content string
 */
export function generateICalFile(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SwiftCare Dental Clinic//Appointment System//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatICalDate(new Date())}`,
    `DTSTART:${formatICalDate(event.startTime)}`,
    `DTEND:${formatICalDate(event.endTime)}`,
    `SUMMARY:${escapeICalText(event.title)}`,
    `DESCRIPTION:${escapeICalText(event.description)}`,
    `LOCATION:${escapeICalText(event.location)}`,
    `ORGANIZER;CN=${event.organizerName}:mailto:${event.organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
  ];

  // Add attendee if provided
  if (event.attendeeEmail) {
    lines.push(`ATTENDEE;CN=${event.attendeeName || event.attendeeEmail};RSVP=TRUE:mailto:${event.attendeeEmail}`);
  }

  // Add reminder (1 day before)
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Dental appointment tomorrow',
    'END:VALARM',
    // Add another reminder (2 hours before)
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Dental appointment in 2 hours',
    'END:VALARM'
  );

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Escapes special characters for iCal text fields
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Creates an appointment calendar event
 */
export function createAppointmentCalendarEvent(
  appointmentId: string,
  appointmentNumber: string,
  appointmentType: string,
  scheduledDatetime: Date,
  durationMinutes: number,
  patientName: string,
  patientEmail: string,
  dentistName?: string,
  reasonForVisit?: string
): CalendarEvent {
  const endTime = new Date(scheduledDatetime.getTime() + durationMinutes * 60 * 1000);
  
  const description = [
    `Appointment Number: ${appointmentNumber}`,
    `Type: ${formatAppointmentType(appointmentType)}`,
    dentistName ? `Dentist: Dr. ${dentistName}` : 'Dentist: To be assigned',
    reasonForVisit ? `Reason: ${reasonForVisit}` : '',
    '',
    'Please arrive 10-15 minutes early to complete any necessary paperwork.',
    'If you need to cancel or reschedule, please contact us at least 24 hours in advance.',
    '',
    'SwiftCare Dental Clinic',
    '2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac',
    'Phone: (02) 8123-4567'
  ].filter(Boolean).join('\n');

  return {
    uid: `appointment-${appointmentId}@swiftcaredental.com`,
    title: `Dental Appointment - ${formatAppointmentType(appointmentType)}`,
    description,
    location: 'SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac',
    startTime: scheduledDatetime,
    endTime,
    organizerName: 'SwiftCare Dental Clinic',
    organizerEmail: 'appointments@swiftcaredental.com',
    attendeeName: patientName,
    attendeeEmail: patientEmail
  };
}

/**
 * Formats appointment type for display
 */
function formatAppointmentType(type: string): string {
  const typeMap: Record<string, string> = {
    consultation: 'Consultation',
    cleaning: 'Teeth Cleaning',
    procedure: 'Dental Procedure',
    surgery: 'Dental Surgery',
    emergency: 'Emergency Visit',
    follow_up: 'Follow-up Visit',
    x_ray: 'X-Ray/Imaging',
    walk_in: 'Walk-in Appointment'
  };
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
