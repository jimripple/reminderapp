// confirmationHandler.js - Handle SMS confirmation responses
require('dotenv').config();
const twilio = require('twilio');
const { 
    updateAppointmentConfirmation, 
    getUpcomingAppointmentByPhone 
} = require('./appointments');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Parse incoming SMS message and determine intent
function parseConfirmationMessage(messageBody) {
    const message = messageBody.trim().toUpperCase();
    
    // Confirmation patterns
    if (/^(YES|Y|CONFIRM|CONFIRMED|OK|OKAY|👍)$/i.test(message)) {
        return { action: 'confirmed', confidence: 'high' };
    }
    
    if (/^(CONFIRM|YES.*|.*YES.*)$/i.test(message)) {
        return { action: 'confirmed', confidence: 'medium' };
    }
    
    // Cancellation patterns
    if (/^(NO|N|CANCEL|CANCELLED|NOPE|❌)$/i.test(message)) {
        return { action: 'cancelled', confidence: 'high' };
    }
    
    if (/^(NO.*|.*NO.*|CANCEL.*|.*CANCEL.*)$/i.test(message)) {
        return { action: 'cancelled', confidence: 'medium' };
    }
    
    // Reschedule patterns
    if (/^(RESCHEDULE|R|CHANGE|MOVE|POSTPONE)$/i.test(message)) {
        return { action: 'reschedule_requested', confidence: 'high' };
    }
    
    if (/^(RESCHEDULE.*|.*RESCHEDULE.*|CHANGE.*|.*CHANGE.*|MOVE.*|.*MOVE.*)$/i.test(message)) {
        return { action: 'reschedule_requested', confidence: 'medium' };
    }
    
    // Stop/Unsubscribe patterns
    if (/^(STOP|UNSUBSCRIBE|QUIT|END|OPTOUT)$/i.test(message)) {
        return { action: 'unsubscribed', confidence: 'high' };
    }
    
    // Default - unclear intent
    return { action: 'unclear', confidence: 'low', originalMessage: message };
}

// Generate response message based on confirmation action
function generateResponseMessage(appointment, action) {
    const { patient_name, doctor_name, appointment_date, appointment_time, practice_name } = appointment;
    const appointmentDateFormatted = new Date(appointment_date).toLocaleDateString();
    
    switch (action) {
        case 'confirmed':
            return `Thank you ${patient_name}! Your appointment with ${doctor_name} on ${appointmentDateFormatted} at ${appointment_time} is CONFIRMED. See you then! - ${practice_name}`;
        
        case 'cancelled':
            return `We've noted that you need to cancel your appointment with ${doctor_name} on ${appointmentDateFormatted} at ${appointment_time}. Please call us to confirm cancellation and reschedule if needed. - ${practice_name}`;
        
        case 'reschedule_requested':
            return `We've received your request to reschedule your appointment with ${doctor_name} on ${appointmentDateFormatted} at ${appointment_time}. Our office will contact you soon to arrange a new time. - ${practice_name}`;
        
        case 'unsubscribed':
            return `You've been unsubscribed from appointment reminders. Reply START to resume reminders. - ${practice_name}`;
        
        default:
            return `We received your message about your appointment with ${doctor_name} on ${appointmentDateFormatted} at ${appointment_time}. If you need to confirm, cancel, or reschedule, please reply with YES, NO, or RESCHEDULE. You can also call us directly. - ${practice_name}`;
    }
}

// Send automatic response to patient
async function sendAutoResponse(phone, message) {
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });
        
        console.log(`✅ Auto-response sent to ${phone}: ${result.sid}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send auto-response to ${phone}:`, error.message);
        return null;
    }
}

// Main function to handle incoming SMS confirmation
async function handleIncomingConfirmation(fromPhone, messageBody) {
    console.log(`📱 Received SMS from ${fromPhone}: "${messageBody}"`);
    
    // Find the upcoming appointment for this phone number
    const appointment = getUpcomingAppointmentByPhone(fromPhone);
    
    if (!appointment) {
        console.log(`❌ No upcoming appointment found for ${fromPhone}`);
        // Could send a generic "no appointment found" message here
        return { success: false, error: 'No upcoming appointment found' };
    }
    
    // Parse the message to determine intent
    const parsed = parseConfirmationMessage(messageBody);
    console.log(`🔍 Parsed message: ${parsed.action} (confidence: ${parsed.confidence})`);
    
    // Update appointment status in database
    const updatedAppointment = updateAppointmentConfirmation(
        fromPhone, 
        parsed.action, 
        messageBody
    );
    
    if (!updatedAppointment) {
        console.log(`❌ Failed to update appointment confirmation`);
        return { success: false, error: 'Failed to update appointment' };
    }
    
    // Generate and send automatic response
    const responseMessage = generateResponseMessage(updatedAppointment, parsed.action);
    await sendAutoResponse(fromPhone, responseMessage);
    
    console.log(`✅ Processed confirmation for ${updatedAppointment.patient_name}: ${parsed.action}`);
    
    return {
        success: true,
        appointment: updatedAppointment,
        action: parsed.action,
        confidence: parsed.confidence,
        response: responseMessage
    };
}

// Test function to simulate incoming confirmations
async function testConfirmation(phone, message) {
    console.log(`🧪 Testing confirmation: ${phone} -> "${message}"`);
    return await handleIncomingConfirmation(phone, message);
}

module.exports = {
    handleIncomingConfirmation,
    parseConfirmationMessage,
    generateResponseMessage,
    testConfirmation
};