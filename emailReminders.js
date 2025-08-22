// emailReminders.js - Email reminder functionality
require('dotenv').config();
const nodemailer = require('nodemailer');

// Create email transporter (using Gmail as example)
let transporter = null;

function initializeEmailTransporter() {
    // For Gmail (you'll need to set up App Password)
    transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER, // Your Gmail address
            pass: process.env.EMAIL_APP_PASSWORD // Gmail App Password (not regular password)
        }
    });
    
    console.log('✅ Email transporter initialized');
}

// Send email reminder
async function sendEmailReminder(appointment) {
    if (!transporter) {
        console.error('❌ Email transporter not initialized');
        return null;
    }
    
    const subject = `Appointment Reminder - ${appointment.practice_name}`;
    
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #4299e1; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0;">📅 Appointment Reminder</h1>
            </div>
            
            <div style="background: #f7fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
                <h2 style="color: #2d3748; margin-top: 0;">Hi ${appointment.patient_name}!</h2>
                
                <p style="color: #4a5568; font-size: 16px; line-height: 1.6;">
                    This is a friendly reminder about your upcoming appointment:
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4299e1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong style="color: #2d3748;">📍 Practice:</strong>
                        <span style="color: #4a5568;">${appointment.practice_name}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong style="color: #2d3748;">👨‍⚕️ Doctor:</strong>
                        <span style="color: #4a5568;">${appointment.doctor_name}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong style="color: #2d3748;">📅 Date:</strong>
                        <span style="color: #4a5568;">${new Date(appointment.appointment_date).toLocaleDateString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong style="color: #2d3748;">⏰ Time:</strong>
                        <span style="color: #4a5568;">${appointment.appointment_time}</span>
                    </div>
                </div>
                
                <p style="color: #4a5568; font-size: 14px; margin-top: 30px;">
                    Please arrive 15 minutes early for check-in. If you need to reschedule, please contact us as soon as possible.
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p style="color: #718096; font-size: 12px;">
                        This is an automated reminder from ${appointment.practice_name}
                    </p>
                </div>
            </div>
        </div>
    `;
    
    const textContent = `
Hi ${appointment.patient_name}!

This is a friendly reminder about your upcoming appointment:

Practice: ${appointment.practice_name}
Doctor: ${appointment.doctor_name}
Date: ${new Date(appointment.appointment_date).toLocaleDateString()}
Time: ${appointment.appointment_time}

Please arrive 15 minutes early for check-in. If you need to reschedule, please contact us as soon as possible.

This is an automated reminder from ${appointment.practice_name}
    `;
    
    const mailOptions = {
        from: `"${appointment.practice_name} Reminders" <${process.env.EMAIL_USER}>`,
        to: appointment.email, // We'll need to add email field to appointments
        subject: subject,
        text: textContent,
        html: htmlContent
    };
    
    try {
        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Email reminder sent to ${appointment.patient_name}: ${result.messageId}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send email reminder to ${appointment.patient_name}:`, error.message);
        return null;
    }
}

// Test email configuration
async function testEmailSetup() {
    if (!transporter) {
        console.error('❌ Email transporter not initialized');
        return false;
    }
    
    try {
        await transporter.verify();
        console.log('✅ Email configuration is valid');
        return true;
    } catch (error) {
        console.error('❌ Email configuration error:', error.message);
        return false;
    }
}

// Send a test email
async function sendTestEmail() {
    const testAppointment = {
        patient_name: "Test Patient",
        email: process.env.TEST_EMAIL || process.env.EMAIL_USER,
        practice_name: "Test Practice",
        doctor_name: "Dr. Test",
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: "10:00 AM"
    };
    
    return await sendEmailReminder(testAppointment);
}

module.exports = {
    initializeEmailTransporter,
    sendEmailReminder,
    testEmailSetup,
    sendTestEmail
};