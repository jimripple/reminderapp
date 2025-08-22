// Appointment Reminder MVP - Now with database!
require('dotenv').config();
const twilio = require('twilio');
const { 
    initializeDatabase, 
    getAppointmentsNeedingReminders, 
    markReminderSent,
    addSampleData 
} = require('./appointments');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Initialize database on startup
initializeDatabase();

// Function to send SMS reminder
async function sendReminder(appointment) {
    const message = `Hi ${appointment.patient_name}! Friendly reminder: You have an appointment with ${appointment.doctor_name} tomorrow at ${appointment.appointment_time}. Reply STOP to opt out.`;
    
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: appointment.phone
        });
        
        console.log(`✅ Reminder sent to ${appointment.patient_name}: ${result.sid}`);
        
        // Mark reminder as sent in database
        markReminderSent(appointment.id);
        
        return result;
    } catch (error) {
        console.error(`❌ Failed to send reminder to ${appointment.patient_name}:`, error.message);
        return null;
    }
}

// Main function to process reminders
async function processReminders() {
    console.log('🔍 Checking for appointments that need reminders...');
    
    // Get appointments from database that need reminders
    const appointmentsNeedingReminders = getAppointmentsNeedingReminders();
    
    if (appointmentsNeedingReminders.length === 0) {
        console.log('📅 No reminders needed today');
        return;
    }
    
    console.log(`📱 Found ${appointmentsNeedingReminders.length} appointments needing reminders`);
    
    for (const appointment of appointmentsNeedingReminders) {
        await sendReminder(appointment);
        // Small delay between messages to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('🎉 All reminders processed!');
}

// Add sample data on first run (comment out after testing)
// Uncomment the line below to add sample data:
// addSampleData();

// Run the script
if (require.main === module) {
    processReminders().catch(console.error);
}