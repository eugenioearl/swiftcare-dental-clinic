/**
 * Email notification utilities for SwiftCare Dental Clinic
 */

interface RejectionEmailData {
  appointmentNumber: string;
  appointmentType: string;
  scheduledDatetime: Date;
  patientName: string;
  patientEmail: string;
  rejectionReason: string;
}

/**
 * Sends appointment rejection email
 */
export async function sendAppointmentRejectionEmail(data: RejectionEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedDate = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    }).format(data.scheduledDatetime);

    const formatType = (type: string): string => {
      const typeMap: Record<string, string> = {
        consultation: 'Consultation', cleaning: 'Teeth Cleaning', procedure: 'Dental Procedure',
        surgery: 'Dental Surgery', emergency: 'Emergency Visit', follow_up: 'Follow-up Visit',
        x_ray: 'X-Ray/Imaging', walk_in: 'Walk-in Appointment', other: 'Other'
      };
      return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const bookingUrl = `${process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'}/book`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Update</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            We regret to inform you that your appointment request could not be accommodated at this time.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 16px;">Appointment Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;">Appointment #:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${data.appointmentNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Date & Time:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${formattedDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Type:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${formatType(data.appointmentType)}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Reason:</td><td style="padding: 8px 0; color: #333;">${data.rejectionReason}</td></tr>
            </table>
          </div>
          <p style="font-size: 15px; color: #333; margin: 20px 0;">
            We encourage you to book a new appointment at a different time that works for you.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${bookingUrl}" style="display: inline-block; background: linear-gradient(135deg, #2D9DA8 0%, #4A90E2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Book New Appointment
            </a>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Need assistance?</strong> Contact us at (02) 8123-4567<br>
              SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            We apologize for any inconvenience.<br><br>
            Warm regards,<br>
            <strong style="color: #2D9DA8;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site';
    const hostname = new URL(appUrl).hostname;

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_APPOINTMENT_REJECTED,
        subject: `Appointment Update - ${data.appointmentNumber}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `appointments@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic'
      }),
    });

    const result = await response.json();
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send rejection notification');
    }
    console.log(`Appointment rejection email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending rejection email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface AppointmentEmailData {
  appointmentId: string;
  appointmentNumber: string;
  appointmentType: string;
  scheduledDatetime: Date;
  durationMinutes: number;
  patientName: string;
  patientEmail: string;
  dentistName?: string;
  reasonForVisit?: string;
}

/**
 * Formats a date to Google Calendar format (YYYYMMDDTHHmmssZ)
 */
function formatGoogleCalendarDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates a Google Calendar add event URL
 */
function generateGoogleCalendarUrl(data: AppointmentEmailData): string {
  const startDate = new Date(data.scheduledDatetime);
  const endDate = new Date(startDate.getTime() + data.durationMinutes * 60 * 1000);
  
  const formatAppointmentType = (type: string): string => {
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
  };

  const title = `Dental Appointment - ${formatAppointmentType(data.appointmentType)}`;
  
  const description = [
    `Appointment Number: ${data.appointmentNumber}`,
    `Type: ${formatAppointmentType(data.appointmentType)}`,
    data.dentistName ? `Dentist: Dr. ${data.dentistName}` : 'Dentist: To be assigned',
    data.reasonForVisit ? `Reason: ${data.reasonForVisit}` : '',
    '',
    'Please arrive 10-15 minutes early.',
    'Contact: (02) 8123-4567'
  ].filter(Boolean).join('\\n');

  const location = 'SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleCalendarDate(startDate)}/${formatGoogleCalendarDate(endDate)}`,
    details: description,
    location: location,
    trp: 'true' // Show as busy
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Sends appointment approval email with calendar invite
 */
export async function sendAppointmentApprovalEmail(data: AppointmentEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate Google Calendar URL
    const googleCalendarUrl = generateGoogleCalendarUrl(data);
    
    // Also generate download link for other calendar apps
    const icsDownloadUrl = `${process.env.NEXTAUTH_URL}/api/appointments/${data.appointmentId}/calendar`;

    // Format date for email
    const formattedDate = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    }).format(data.scheduledDatetime);

    const formatAppointmentType = (type: string): string => {
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
    };

    // Create HTML email body
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0080FF 0%, #2D9DA8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Appointment Confirmed! ✓</h1>
        </div>
        
        <!-- Main Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
            Great news! Your dental appointment has been <strong style="color: #22B573;">approved and confirmed</strong>.
          </p>
          
          <!-- Appointment Details Card -->
          <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h2 style="color: #0080FF; margin: 0 0 20px 0; font-size: 18px; border-bottom: 2px solid #0080FF; padding-bottom: 10px;">
              📅 Appointment Details
            </h2>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; width: 140px;">Appointment #:</td>
                <td style="padding: 10px 0; color: #333; font-weight: bold;">${data.appointmentNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Date & Time:</td>
                <td style="padding: 10px 0; color: #333; font-weight: bold;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Duration:</td>
                <td style="padding: 10px 0; color: #333; font-weight: bold;">${data.durationMinutes} minutes</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Type:</td>
                <td style="padding: 10px 0; color: #333; font-weight: bold;">${formatAppointmentType(data.appointmentType)}</td>
              </tr>
              ${data.dentistName ? `
              <tr>
                <td style="padding: 10px 0; color: #666;">Dentist:</td>
                <td style="padding: 10px 0; color: #333; font-weight: bold;">Dr. ${data.dentistName}</td>
              </tr>
              ` : ''}
              ${data.reasonForVisit ? `
              <tr>
                <td style="padding: 10px 0; color: #666;">Reason:</td>
                <td style="padding: 10px 0; color: #333;">${data.reasonForVisit}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Calendar Invite Buttons -->
          <div style="background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 20px 0; color: #1e40af; font-size: 16px; font-weight: bold;">
              📅 Add to Your Calendar
            </p>
            
            <!-- Google Calendar Button (Primary) -->
            <a href="${googleCalendarUrl}" 
               target="_blank"
               style="display: inline-block; background: #4285f4; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4); margin-bottom: 15px;">
              <span style="vertical-align: middle;">📆</span> Add to Google Calendar
            </a>
            
            <p style="margin: 15px 0 10px 0; color: #64748b; font-size: 12px;">
              Using another calendar app?
            </p>
            
            <!-- Download .ics Button (Secondary) -->
            <a href="${icsDownloadUrl}" 
               style="display: inline-block; background: white; color: #475569; padding: 10px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; border: 2px solid #cbd5e1;">
              ⬇️ Download .ics file
            </a>
            
            <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px;">
              Works with Outlook, Apple Calendar, and other apps
            </p>
          </div>
          
          <!-- Location -->
          <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #2D9DA8; margin: 0 0 10px 0; font-size: 16px;">📍 Location</h3>
            <p style="margin: 0; color: #333;">
              <strong>SwiftCare Dental Clinic</strong><br>
              2nd Floor, Sicangco Building<br>
              Mac Arthur Hi-way, San Rafael, Tarlac<br>
              Phone: (02) 8123-4567
            </p>
          </div>
          
          <!-- Important Notes -->
          <div style="border-left: 4px solid #0080FF; padding-left: 15px; margin: 25px 0;">
            <h3 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">📋 Important Reminders</h3>
            <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Please arrive <strong>10-15 minutes early</strong> for check-in</li>
              <li>Bring a valid ID and insurance card (if applicable)</li>
              <li>To reschedule or cancel, please notify us <strong>at least 24 hours</strong> in advance</li>
            </ul>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/patient/appointments" 
               style="display: inline-block; background: linear-gradient(135deg, #0080FF 0%, #2D9DA8 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              View My Appointments
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            We look forward to seeing you!<br><br>
            Warm regards,<br>
            <strong style="color: #0080FF;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p style="margin: 0;">This is an automated message from SwiftCare Dental Clinic.</p>
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `;

    // Get app URL for sender email
    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site';
    const hostname = new URL(appUrl).hostname;

    // Send email with calendar download link
    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_APPOINTMENT_APPROVED,
        subject: `✓ Appointment Confirmed - ${formattedDate}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `appointments@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic'
      }),
    });

    const result = await response.json();
    
    if (!result.success) {
      // Check if notification was disabled by user
      if (result.notification_disabled) {
        console.log('Appointment notification disabled by user, skipping email');
        return { success: true }; // Don't treat as error
      }
      throw new Error(result.message || 'Failed to send notification');
    }

    console.log(`Appointment approval email sent successfully to ${data.patientEmail}`);
    return { success: true };

  } catch (error) {
    console.error('Error sending appointment approval email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}


interface CancellationEmailData {
  appointmentNumber: string;
  appointmentType: string;
  scheduledDatetime: Date;
  patientName: string;
  patientEmail: string;
  cancellationReason?: string;
}

/**
 * Sends appointment cancellation email
 */
export async function sendAppointmentCancellationEmail(data: CancellationEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedDate = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    }).format(data.scheduledDatetime);

    const formatType = (type: string): string => {
      const typeMap: Record<string, string> = {
        consultation: 'Consultation', cleaning: 'Teeth Cleaning', procedure: 'Dental Procedure',
        surgery: 'Dental Surgery', emergency: 'Emergency Visit', follow_up: 'Follow-up Visit',
        x_ray: 'X-Ray/Imaging', walk_in: 'Walk-in Appointment', other: 'Other'
      };
      return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const bookingUrl = `${process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'}/book`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Cancelled</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            We are writing to let you know that your appointment with SwiftCare Dental Clinic has been cancelled.
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 16px;">Cancelled Appointment Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;">Appointment #:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${data.appointmentNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Original Date & Time:</td><td style="padding: 8px 0; color: #333; font-weight: bold; text-decoration: line-through;">${formattedDate}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Type:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${formatType(data.appointmentType)}</td></tr>
              ${data.cancellationReason ? `<tr><td style="padding: 8px 0; color: #666;">Reason:</td><td style="padding: 8px 0; color: #333;">${data.cancellationReason}</td></tr>` : ''}
            </table>
          </div>
          <p style="font-size: 15px; color: #333; margin: 20px 0;">
            You can book a new appointment at your convenience.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${bookingUrl}" style="display: inline-block; background: linear-gradient(135deg, #2D9DA8 0%, #4A90E2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Book New Appointment
            </a>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Need assistance?</strong> Contact us at (02) 8123-4567<br>
              SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            We apologize for any inconvenience caused.<br><br>
            Warm regards,<br>
            <strong style="color: #2D9DA8;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site';
    const hostname = new URL(appUrl).hostname;

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_APPOINTMENT_CANCELLED,
        subject: `Appointment Cancelled - ${data.appointmentNumber}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `appointments@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic'
      }),
    });

    const result = await response.json();
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send cancellation notification');
    }
    console.log(`Appointment cancellation email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending cancellation email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

interface RescheduleEmailData {
  appointmentNumber: string;
  appointmentType: string;
  oldDatetime: Date;
  newDatetime: Date;
  durationMinutes: number;
  patientName: string;
  patientEmail: string;
  dentistName?: string;
}

/**
 * Sends appointment reschedule email
 */
export async function sendAppointmentRescheduleEmail(data: RescheduleEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const fmt = (date: Date) => new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila'
    }).format(date);

    const formatType = (type: string): string => {
      const typeMap: Record<string, string> = {
        consultation: 'Consultation', cleaning: 'Teeth Cleaning', procedure: 'Dental Procedure',
        surgery: 'Dental Surgery', emergency: 'Emergency Visit', follow_up: 'Follow-up Visit',
        x_ray: 'X-Ray/Imaging', walk_in: 'Walk-in Appointment', other: 'Other'
      };
      return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Appointment Rescheduled</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Your appointment with SwiftCare Dental Clinic has been rescheduled. Please find the updated details below.
          </p>
          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #92400e; margin: 0 0 15px 0; font-size: 16px;">Updated Appointment</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #666;">Appointment #:</td><td style="padding: 8px 0; color: #333; font-weight: bold;">${data.appointmentNumber}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Previous Time:</td><td style="padding: 8px 0; color: #999; text-decoration: line-through;">${fmt(data.oldDatetime)}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">New Time:</td><td style="padding: 8px 0; color: #16a34a; font-weight: bold; font-size: 16px;">${fmt(data.newDatetime)}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Duration:</td><td style="padding: 8px 0; color: #333;">${data.durationMinutes} minutes</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Type:</td><td style="padding: 8px 0; color: #333;">${formatType(data.appointmentType)}</td></tr>
              ${data.dentistName ? `<tr><td style="padding: 8px 0; color: #666;">Dentist:</td><td style="padding: 8px 0; color: #333;">Dr. ${data.dentistName}</td></tr>` : ''}
            </table>
          </div>
          <p style="font-size: 15px; color: #333; margin: 20px 0;">
            Please arrive 10-15 minutes early for check-in. If this new time does not work for you, kindly contact us as soon as possible.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Need to make changes?</strong> Contact us at (02) 8123-4567<br>
              SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            Thank you for your understanding.<br><br>
            Warm regards,<br>
            <strong style="color: #2D9DA8;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `;

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site';
    const hostname = new URL(appUrl).hostname;

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_APPOINTMENT_RESCHEDULED,
        subject: `Appointment Rescheduled - ${data.appointmentNumber}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `appointments@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic'
      }),
    });

    const result = await response.json();
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send reschedule notification');
    }
    console.log(`Appointment reschedule email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending reschedule email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}


// ============================================================
// Treatment Plan Emails
// ============================================================

interface TreatmentPlanCreatedEmailData {
  planId: string
  planTitle: string
  patientName: string
  patientEmail: string
  dentistName?: string | null
  totalPhases?: number
  estimatedCost?: number | null
  description?: string | null
}

/**
 * Sends an email to the patient announcing a newly-created treatment plan
 * awaiting their review / approval.
 */
export async function sendTreatmentPlanCreatedEmail(
  data: TreatmentPlanCreatedEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const hostname = new URL(appUrl).hostname
    const planUrl = `${appUrl}/patient/dashboard`

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #2D9DA8 0%, #22B573 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Treatment Plan Ready</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            ${data.dentistName ? `Dr. ${data.dentistName}` : 'Your dentist'} has prepared a new treatment plan for you.
            Please review and approve it at your earliest convenience.
          </p>
          <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h2 style="color: #0f766e; margin: 0 0 15px 0; font-size: 16px;">Plan Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #64748b;">Title:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.planTitle}</td></tr>
              ${data.dentistName ? `<tr><td style="padding: 6px 0; color: #64748b;">Dentist:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">Dr. ${data.dentistName}</td></tr>` : ''}
              ${typeof data.totalPhases === 'number' ? `<tr><td style="padding: 6px 0; color: #64748b;">Phases:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${data.totalPhases}</td></tr>` : ''}
              ${typeof data.estimatedCost === 'number' ? `<tr><td style="padding: 6px 0; color: #64748b;">Estimated cost:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">₱${data.estimatedCost.toLocaleString()}</td></tr>` : ''}
            </table>
            ${data.description ? `<p style="margin: 15px 0 0 0; font-size: 14px; color: #334155;">${data.description}</p>` : ''}
          </div>
          <p style="font-size: 14px; color: #334155; margin-bottom: 20px;">
            Please note that prices shown are estimates and may vary based on final clinical assessment.
            You will have the opportunity to review and approve the plan before any treatment starts.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${planUrl}" style="display: inline-block; background: linear-gradient(135deg, #2D9DA8 0%, #22B573 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Review Treatment Plan
            </a>
          </div>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #333; font-size: 14px;">
              <strong>Questions?</strong> Call (02) 8123-4567 or reply to this email.<br>
              SwiftCare Dental Clinic, 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            Warm regards,<br>
            <strong style="color: #2D9DA8;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 15px; color: #999; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_TREATMENT_PLAN_CREATED,
        subject: `New Treatment Plan: ${data.planTitle}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `care@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic',
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send treatment plan email')
    }
    console.log(`Treatment plan created email sent to ${data.patientEmail}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending treatment plan created email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

interface TreatmentPlanApprovedEmailData {
  planId: string
  planTitle: string
  patientName: string
  dentistEmail?: string | null
  adminEmail?: string | null
  approval?: 'approval' | 'consent' | 'both'
}

/**
 * Notifies the dentist/admin when a patient approves or signs consent
 * on a treatment plan.
 */
export async function sendTreatmentPlanApprovedEmail(
  data: TreatmentPlanApprovedEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const recipient = data.dentistEmail || data.adminEmail
    if (!recipient) return { success: false, error: 'No recipient email provided' }

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const hostname = new URL(appUrl).hostname
    const planUrl = `${appUrl}/admin/patients`
    const what = data.approval === 'consent'
      ? 'signed informed consent for'
      : data.approval === 'both'
        ? 'approved and signed consent for'
        : 'approved'

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #22B573 0%, #2D9DA8 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Treatment Plan Approved</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello,</p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            Patient <strong>${data.patientName}</strong> has <strong>${what}</strong> the treatment plan
            "<strong>${data.planTitle}</strong>". You may now proceed to activate the plan and schedule treatment.
          </p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${planUrl}" style="display: inline-block; background: linear-gradient(135deg, #22B573 0%, #2D9DA8 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Open Patient Record
            </a>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 25px;">
            — SwiftCare Dental Clinic
          </p>
        </div>
      </div>
    `

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_TREATMENT_PLAN_APPROVED,
        subject: `Plan Approved: ${data.patientName} — ${data.planTitle}`,
        body: htmlBody,
        is_html: true,
        recipient_email: recipient,
        sender_email: `care@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic',
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send plan approval email')
    }
    console.log(`Treatment plan approved email sent to ${recipient}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending plan approved email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


interface FormSigningLinkEmailData {
  patientEmail: string
  patientName: string
  signingUrl: string
  formType?: string // e.g., "Patient Intake", "Consent Forms", "Medical History"
  appointmentDate?: string | Date | null
  appointmentType?: string | null
  senderNote?: string | null
  expiresInHours?: number | null
}

/**
 * Sends a secure signing link to the patient's email so they can fill out
 * consent / intake / check-in forms remotely.
 */
export async function sendFormSigningLinkEmail(
  data: FormSigningLinkEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const hostname = new URL(appUrl).hostname
    const friendlyFormType = data.formType || 'Patient Forms'
    const apptDateStr = data.appointmentDate
      ? new Date(data.appointmentDate).toLocaleString('en-PH', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : null
    const expiresHours = data.expiresInHours ?? 72

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, #2D9DA8 0%, #22B573 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Please Complete Your Forms</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 18px;">
            Dear <strong>${data.patientName}</strong>,
          </p>
          <p style="font-size: 15px; color: #333; margin-bottom: 18px;">
            To make your upcoming visit smooth and fast, please fill out and sign your
            <strong>${friendlyFormType}</strong> online before arriving at the clinic.
          </p>
          ${
            apptDateStr || data.appointmentType
              ? `
          <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 18px; margin: 20px 0;">
            <h2 style="color: #0f766e; margin: 0 0 12px 0; font-size: 15px;">Your Appointment</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${apptDateStr ? `<tr><td style="padding: 4px 0; color: #64748b;">Date &amp; Time:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${apptDateStr}</td></tr>` : ''}
              ${data.appointmentType ? `<tr><td style="padding: 4px 0; color: #64748b;">Type:</td><td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${data.appointmentType}</td></tr>` : ''}
            </table>
          </div>`
              : ''
          }
          ${data.senderNote ? `<p style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 14px; color: #78350f; font-size: 14px; border-radius: 4px;">${data.senderNote}</p>` : ''}
          <div style="text-align: center; margin: 28px 0 18px;">
            <a href="${data.signingUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #2D9DA8 0%, #22B573 100%); color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Open &amp; Sign Forms
            </a>
          </div>
          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 14px 0;">
            Or copy this link into your browser:<br>
            <a href="${data.signingUrl}" style="color: #2D9DA8; word-break: break-all;">${data.signingUrl}</a>
          </p>
          <p style="font-size: 13px; color: #64748b; margin: 12px 0;">
            This secure link will expire in about <strong>${expiresHours} hours</strong>. If it expires, please
            ask our staff to send you a new one.
          </p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 14px; margin: 22px 0;">
            <p style="margin: 0; color: #333; font-size: 13px; line-height: 1.5;">
              <strong>Need help?</strong> Call (02) 8123-4567 or reply to this email.<br>
              SwiftCare Dental Clinic — 2nd Floor, Sicangco Building, Mac Arthur Hi-way, San Rafael, Tarlac.
            </p>
          </div>
          <p style="color: #666; font-size: 14px; margin-top: 22px;">
            Warm regards,<br>
            <strong style="color: #2D9DA8;">SwiftCare Dental Clinic Team</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 14px; color: #999; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    `

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_FORM_SIGNING_LINK_EMAIL,
        subject: `Please complete your ${friendlyFormType} — SwiftCare Dental`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.patientEmail,
        sender_email: `care@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic',
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send form signing link email')
    }
    console.log(`Form signing link email sent to ${data.patientEmail}`)
    return { success: true }
  } catch (error) {
    console.error('Error sending form signing link email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ===========================================================================
// Dentist / Emergency appointment email notifications (added in Wave 10)
// ===========================================================================

interface DentistAppointmentEmailData {
  appointmentId?: string
  appointmentNumber: string
  appointmentType: string
  scheduledDatetime: Date
  durationMinutes?: number
  patientName: string
  patientNumber?: string
  dentistName?: string
  dentistEmail: string
  /**
   * The user-id of the dentist this email is addressed to. Embedded in the
   * deep-link so the app can detect if someone else is clicking the link on
   * a shared device and warn them (prevents the "dentist opens link but is
   * signed in as admin" confusion).
   */
  dentistUserId?: string
  reasonForVisit?: string
  reason?: string
  priority?: 'normal' | 'urgent' | 'emergency'
  eventKind: 'assigned' | 'cancelled' | 'rescheduled' | 'emergency'
  oldDatetime?: Date
  cancellationReason?: string
  clinicName?: string
}

/**
 * Sends an email to a dentist when an appointment is assigned to them,
 * cancelled, rescheduled, or flagged as an emergency.
 *
 * Returns { success: true } on success; never throws — failures are logged.
 */
export async function sendDentistAppointmentEmail(
  data: DentistAppointmentEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedDate = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
    }).format(data.scheduledDatetime)
    const formattedOld = data.oldDatetime ? new Intl.DateTimeFormat('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
    }).format(data.oldDatetime) : null

    const formatType = (type: string): string => {
      const typeMap: Record<string, string> = {
        consultation: 'Consultation', cleaning: 'Teeth Cleaning', procedure: 'Dental Procedure',
        surgery: 'Dental Surgery', emergency: 'Emergency Visit', follow_up: 'Follow-up Visit',
        x_ray: 'X-Ray/Imaging', walk_in: 'Walk-in Appointment', other: 'Other',
      }
      return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const hostname = new URL(appUrl).hostname
    // Link goes directly to the canonical operations board with the appointment
    // pre-selected. `forUserId` lets the board detect a role mismatch (e.g. a
    // shared tablet still signed in as admin) and prompt the user to switch.
    const linkParams = new URLSearchParams({
      tab: 'upcoming',
      appointmentId: String(data.appointmentId || ''),
    })
    if (data.dentistUserId) linkParams.set('forUserId', data.dentistUserId)
    const link = `${appUrl}/admin/scheduling?${linkParams.toString()}`

    const isEmergency = data.eventKind === 'emergency' || data.priority === 'emergency'
    const isCancelled = data.eventKind === 'cancelled'
    const isRescheduled = data.eventKind === 'rescheduled'

    let headerGradient = 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)' // teal
    let headerTitle = 'Appointment Assigned'
    let introLine = 'A new appointment has been assigned to you.'
    if (isEmergency) {
      headerGradient = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
      headerTitle = '🚨 EMERGENCY Appointment Assigned'
      introLine = 'An <strong>emergency appointment</strong> has been assigned to you. Please prepare immediately.'
    } else if (isCancelled) {
      headerGradient = 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
      headerTitle = 'Assigned Appointment Cancelled'
      introLine = 'An appointment previously assigned to you has been cancelled.'
    } else if (isRescheduled) {
      headerGradient = 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
      headerTitle = 'Assigned Appointment Rescheduled'
      introLine = 'An appointment assigned to you has been rescheduled.'
    }

    const clinicName = data.clinicName || 'SwiftCare Dental Clinic'

    const rowsHtml = `
      <tr><td style="padding:8px 0;color:#666;">Appointment #:</td><td style="padding:8px 0;color:#111;font-weight:600;">${data.appointmentNumber}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Patient:</td><td style="padding:8px 0;color:#111;font-weight:600;">${data.patientName}${data.patientNumber ? ` (${data.patientNumber})` : ''}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">${isRescheduled && formattedOld ? 'New Date/Time' : 'Date/Time'}:</td><td style="padding:8px 0;color:#111;font-weight:600;">${formattedDate}</td></tr>
      ${isRescheduled && formattedOld ? `<tr><td style="padding:8px 0;color:#666;">Previous Date/Time:</td><td style="padding:8px 0;color:#666;text-decoration:line-through;">${formattedOld}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#666;">Duration:</td><td style="padding:8px 0;color:#111;">${data.durationMinutes} minutes</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Type:</td><td style="padding:8px 0;color:#111;font-weight:600;">${formatType(data.appointmentType)}</td></tr>
      ${data.priority ? `<tr><td style="padding:8px 0;color:#666;">Priority:</td><td style="padding:8px 0;color:${isEmergency ? '#dc2626' : '#111'};font-weight:600;text-transform:uppercase;">${data.priority}</td></tr>` : ''}
      ${data.reasonForVisit ? `<tr><td style="padding:8px 0;color:#666;">Reason:</td><td style="padding:8px 0;color:#111;">${data.reasonForVisit}</td></tr>` : ''}
      ${data.cancellationReason ? `<tr><td style="padding:8px 0;color:#666;">Cancel Reason:</td><td style="padding:8px 0;color:#111;">${data.cancellationReason}</td></tr>` : ''}
    `

    const htmlBody = `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;">
        <div style="background:${headerGradient};padding:30px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:22px;">${headerTitle}</h1>
          <p style="color:rgba(255,255,255,0.9);margin:6px 0 0 0;font-size:13px;">${clinicName}</p>
        </div>
        <div style="background:white;padding:30px;border-radius:0 0 8px 8px;">
          <p style="font-size:16px;color:#333;margin:0 0 12px;">Dear Dr. ${data.dentistName},</p>
          <p style="font-size:15px;color:#333;margin:0 0 18px;">${introLine}</p>
          <div style="background:${isEmergency ? '#fef2f2' : '#f0fdfa'};border:1px solid ${isEmergency ? '#fecaca' : '#99f6e4'};border-radius:12px;padding:18px;margin:18px 0;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">${rowsHtml}</table>
          </div>
          <p style="text-align:center;margin:22px 0;">
            <a href="${link}" style="display:inline-block;background:${isEmergency ? '#dc2626' : '#0d9488'};color:white;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none;">
              ${isCancelled ? 'View Details' : 'Open Appointment'}
            </a>
          </p>
          <p style="font-size:12px;color:#888;text-align:center;margin:20px 0 0;">${clinicName} &middot; Automated notification</p>
        </div>
      </div>
    `

    const subjectPrefix = isEmergency
      ? '🚨 EMERGENCY Appointment'
      : isCancelled
        ? 'Appointment Cancelled'
        : isRescheduled
          ? 'Appointment Rescheduled'
          : 'New Appointment Assigned'

    const notificationId = isEmergency
      ? process.env.NOTIF_ID_EMERGENCY_APPOINTMENT_ALERT
      : process.env.NOTIF_ID_DENTIST_APPOINTMENT_ASSIGNED

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: notificationId,
        subject: `${subjectPrefix} - ${data.appointmentNumber}`,
        body: htmlBody,
        is_html: true,
        recipient_email: data.dentistEmail,
        sender_email: `appointments@${hostname}`,
        sender_alias: clinicName,
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send dentist notification email')
    }
    console.log(`[Dentist email] ${data.eventKind} email sent to ${data.dentistEmail}`)
    return { success: true }
  } catch (error) {
    console.error('[Dentist email] send failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}


// ===========================================================================
// ADMIN MAILBOX ALERT  — new appointment created (any source)
// Sent to the clinic's shared admin mailbox (Swiftcaredental@gmail.com) every
// time an appointment is created, regardless of origin (patient self-booking,
// walk-in, staff booking, emergency). Safe to call from any creation path —
// errors are swallowed and logged.
// ===========================================================================

export interface AdminAppointmentAlertData {
  appointmentId: string
  appointmentNumber: string
  appointmentType: string
  scheduledDatetime: Date
  patientName: string
  patientEmail?: string | null
  patientPhone?: string | null
  dentistName?: string | null
  notes?: string | null
  status?: string | null
  /**
   * Origin of the booking. Controls the badge text and headline on the email.
   * - 'walk_in'        → walk-in patient checked in at reception
   * - 'patient_booking' → public /book page or patient portal
   * - 'staff_booking'  → staff created on behalf of a patient
   * - 'admin_booking'  → admin created from operations board
   * - 'emergency'      → emergency appointment request
   */
  source:
    | 'walk_in'
    | 'patient_booking'
    | 'staff_booking'
    | 'admin_booking'
    | 'emergency'
}

/**
 * Fixed admin mailbox for every new-appointment alert. User-provided.
 * Kept in one place so it is easy to update if the clinic changes addresses.
 */
export const ADMIN_ALERT_MAILBOX = 'Swiftcaredental@gmail.com'

function formatApptType(type: string): string {
  const typeMap: Record<string, string> = {
    consultation: 'Consultation',
    cleaning: 'Teeth Cleaning',
    procedure: 'Dental Procedure',
    surgery: 'Dental Surgery',
    emergency: 'Emergency Visit',
    follow_up: 'Follow-up Visit',
    x_ray: 'X-Ray/Imaging',
    walk_in: 'Walk-in Appointment',
    other: 'Other',
  }
  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function sourceMeta(source: AdminAppointmentAlertData['source']): {
  label: string
  emoji: string
  color: string
  badge: string
} {
  switch (source) {
    case 'walk_in':
      return { label: 'Walk-in', emoji: '🚶', color: '#0891b2', badge: 'WALK-IN' }
    case 'emergency':
      return { label: 'Emergency', emoji: '🚨', color: '#dc2626', badge: 'EMERGENCY' }
    case 'staff_booking':
      return { label: 'Staff booking', emoji: '👩‍💼', color: '#7c3aed', badge: 'STAFF BOOKED' }
    case 'admin_booking':
      return { label: 'Admin booking', emoji: '🛠️', color: '#2D9DA8', badge: 'ADMIN BOOKED' }
    case 'patient_booking':
    default:
      return { label: 'Patient self-booking', emoji: '📅', color: '#059669', badge: 'ONLINE BOOKING' }
  }
}

/**
 * Sends an internal alert email to the clinic admin mailbox
 * (Swiftcaredental@gmail.com) whenever any appointment is created — regardless
 * of source (patient self-booking, walk-in, staff-created, admin-created,
 * emergency). Fail-safe: errors are swallowed + logged only.
 */
export async function sendAdminNewAppointmentEmail(
  data: AdminAppointmentAlertData
): Promise<{ success: boolean; error?: string }> {
  try {
    const meta = sourceMeta(data.source)

    const formattedDate = new Intl.DateTimeFormat('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(data.scheduledDatetime)

    const appUrl = process.env.NEXTAUTH_URL || 'https://swiftcaredental.site'
    const deepLink = `${appUrl}/admin/scheduling?tab=upcoming&appointmentId=${encodeURIComponent(
      data.appointmentId
    )}`

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc;">
        <div style="background: linear-gradient(135deg, ${meta.color} 0%, ${meta.color}dd 100%); padding: 24px; text-align: center;">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; margin-bottom: 10px;">
            ${meta.badge}
          </div>
          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">
            ${meta.emoji} New appointment created
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 13px;">
            ${meta.label} · Ref # ${data.appointmentNumber}
          </p>
        </div>
        <div style="background: white; padding: 26px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.5;">
            A new <strong>${formatApptType(data.appointmentType)}</strong> appointment has just been booked.
            Full details are listed below. Click the button at the bottom to open it in the Operations Board.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 12px 0; background: #f9fafb; border-radius: 6px; overflow: hidden;">
            <tr>
              <td style="padding: 10px 14px; font-weight: 600; color: #4b5563; width: 40%; border-bottom: 1px solid #e5e7eb;">Patient</td>
              <td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${data.patientName || '—'}</td>
            </tr>
            ${
              data.patientEmail
                ? `<tr><td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Email</td><td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${data.patientEmail}</td></tr>`
                : ''
            }
            ${
              data.patientPhone
                ? `<tr><td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Phone</td><td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${data.patientPhone}</td></tr>`
                : ''
            }
            <tr>
              <td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Type</td>
              <td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${formatApptType(data.appointmentType)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">When</td>
              <td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
            </tr>
            ${
              data.dentistName
                ? `<tr><td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Assigned dentist</td><td style="padding: 10px 14px; color: #111827; border-bottom: 1px solid #e5e7eb;">${data.dentistName}</td></tr>`
                : `<tr><td style="padding: 10px 14px; font-weight: 600; color: #4b5563; border-bottom: 1px solid #e5e7eb;">Assigned dentist</td><td style="padding: 10px 14px; color: #9ca3af; font-style: italic; border-bottom: 1px solid #e5e7eb;">Not yet assigned</td></tr>`
            }
            <tr>
              <td style="padding: 10px 14px; font-weight: 600; color: #4b5563; ${data.notes ? 'border-bottom: 1px solid #e5e7eb;' : ''}">Status</td>
              <td style="padding: 10px 14px; color: #111827; ${data.notes ? 'border-bottom: 1px solid #e5e7eb;' : ''}">${data.status || 'pending'}</td>
            </tr>
            ${
              data.notes
                ? `<tr><td style="padding: 10px 14px; font-weight: 600; color: #4b5563; vertical-align: top;">Notes</td><td style="padding: 10px 14px; color: #111827; white-space: pre-wrap;">${data.notes}</td></tr>`
                : ''
            }
          </table>
          <div style="text-align: center; margin: 22px 0 10px;">
            <a href="${deepLink}" style="display: inline-block; background: ${meta.color}; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Open in Operations Board
            </a>
          </div>
          <p style="font-size: 12px; color: #6b7280; margin: 18px 0 0; text-align: center; line-height: 1.5;">
            This is an automated internal alert. No action is required from this email address — manage the appointment from the Operations Board.
          </p>
        </div>
        <div style="text-align: center; padding: 14px; color: #9ca3af; font-size: 11px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} SwiftCare Dental Clinic · Internal admin alert</p>
        </div>
      </div>
    `

    const hostname = new URL(appUrl).hostname

    const response = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_NEW_APPOINTMENT_ALERT_ADMIN,
        subject: `[${meta.badge}] New appointment — ${data.patientName} · ${data.appointmentNumber}`,
        body: htmlBody,
        is_html: true,
        recipient_email: ADMIN_ALERT_MAILBOX,
        sender_email: `appointments@${hostname}`,
        sender_alias: 'SwiftCare Dental Clinic',
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!result.success && !result.notification_disabled) {
      throw new Error(result.message || 'Failed to send admin mailbox alert')
    }
    console.log(
      `[Admin mailbox alert] ${data.source} appointment ${data.appointmentNumber} → ${ADMIN_ALERT_MAILBOX}`
    )
    return { success: true }
  } catch (error) {
    console.error('[Admin mailbox alert] send failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}