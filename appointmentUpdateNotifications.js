// appointmentUpdateNotifications.js - Send SMS when appointments are updated
require('dotenv').config();
const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Send appointment update SMS notification
async function sendAppointmentUpdateSMS(appointment) {
    // Format checklist for SMS
    const formatChecklistForSMS = (checklist) => {
        if (!checklist) return '';
        const items = checklist.split('\n').filter(item => item.trim());
        if (items.length === 0) return '';
        return '\n\nUpdated checklist:\n' + items.map((item, index) => `${index + 1}. ${item.trim()}`).join('\n');
    };
    
    const checklistText = formatChecklistForSMS(appointment.pre_visit_checklist || '');
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
    
    const message = `📅 APPOINTMENT UPDATE from ${appointment.practice_name}

Hi ${appointment.patient_name}! Your appointment details have been updated:

📍 ${appointment.appointment_type} with ${appointment.doctor_name}
📅 ${appointmentDate} at ${appointment.appointment_time}${checklistText}

Please save these new details. Reply YES to confirm you received this update.

If you have questions, please call us directly.`;

    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: appointment.phone
        });
        
        console.log(`✅ Update notification sent to ${appointment.patient_name}: ${result.sid}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send update notification to ${appointment.patient_name}: ${error.message}`);
        throw error;
    }
}

// Send cancellation notification
async function sendCancellationSMS(appointment) {
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();
    
    const message = `❌ APPOINTMENT CANCELLED - ${appointment.practice_name}

Hi ${appointment.patient_name}, your appointment has been cancelled:

${appointment.appointment_type} with ${appointment.doctor_name}
Originally scheduled: ${appointmentDate} at ${appointment.appointment_time}

Please call us to reschedule: [PRACTICE PHONE NUMBER]

We apologize for any inconvenience.`;

    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: appointment.phone
        });
        
        console.log(`✅ Cancellation notification sent to ${appointment.patient_name}: ${result.sid}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send cancellation notification to ${appointment.patient_name}: ${error.message}`);
        throw error;
    }
}

// Send reschedule notification (when moving to new time)
async function sendRescheduleSMS(appointment, oldDate, oldTime) {
    const formatChecklistForSMS = (checklist) => {
        if (!checklist) return '';
        const items = checklist.split('\n').filter(item => item.trim());
        if (items.length === 0) return '';
        return '\n\nReminder checklist:\n' + items.map((item, index) => `${index + 1}. ${item.trim()}`).join('\n');
    };
    
    const checklistText = formatChecklistForSMS(appointment.pre_visit_checklist || '');
    const newDate = new Date(appointment.appointment_date).toLocaleDateString();
    const oldDateFormatted = new Date(oldDate).toLocaleDateString();
    
    const message = `🔄 APPOINTMENT RESCHEDULED - ${appointment.practice_name}

Hi ${appointment.patient_name}! Your appointment has been moved:

❌ OLD: ${oldDateFormatted} at ${oldTime}
✅ NEW: ${newDate} at ${appointment.appointment_time}

${appointment.appointment_type} with ${appointment.doctor_name}${checklistText}

Please update your calendar. Reply YES to confirm you received this update.`;

    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: appointment.phone
        });
        
        console.log(`✅ Reschedule notification sent to ${appointment.patient_name}: ${result.sid}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send reschedule notification to ${appointment.patient_name}: ${error.message}`);
        throw error;
    }
}

module.exports = {
    sendAppointmentUpdateSMS,
    sendCancellationSMS,
    sendRescheduleSMS
};