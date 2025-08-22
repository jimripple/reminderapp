// server.js - Web dashboard for appointment management
const express = require('express');
const path = require('path');
const { 
    initializeDatabase, 
    addAppointment, 
    getAllAppointments,
    getAppointmentsByDate,
    getAppointmentById,
    checkAppointmentConflicts,
    updateAppointment,
    deleteAppointment,
    getAppointmentsNeedingReminders
} = require('./appointments');
const { handleIncomingConfirmation } = require('./confirmationHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Set up EJS templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Routes

// Home page - Dashboard
app.get('/', async (req, res) => {
    try {
        const allAppointments = getAllAppointments();
        const upcomingReminders = getAppointmentsNeedingReminders();
        
        res.render('dashboard', { 
            appointments: allAppointments,
            upcomingReminders: upcomingReminders,
            message: req.query.message || null
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Add appointment page
app.get('/add', (req, res) => {
    res.render('add-appointment', { 
        message: null,
        showConflictOverride: false,
        formData: null
    });
});

// Handle adding new appointment (FIXED VERSION)
app.post('/add', (req, res) => {
    try {
        const { patientName, phone, email, appointmentDate, appointmentTime, doctorName, practiceName, appointmentType, preVisitChecklist, overrideConflict } = req.body;
        
        console.log('📝 Add appointment request:', {
            patientName,
            phone,
            appointmentDate,
            appointmentTime,
            doctorName,
            overrideConflict: !!overrideConflict
        });
        
        // Basic validation
        if (!patientName || !phone || !appointmentDate || !appointmentTime) {
            console.log('❌ Missing required fields');
            return res.render('add-appointment', { 
                message: 'Please fill in all required fields',
                showConflictOverride: false,
                formData: req.body
            });
        }
        
        // Format phone number (add +1 if not present)
        let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
        if (formattedPhone.length === 10) {
            formattedPhone = '+1' + formattedPhone;
        } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
            formattedPhone = '+' + formattedPhone;
        } else {
            formattedPhone = phone; // Keep original if can't format
        }
        
        const doctorNameToCheck = doctorName || 'Dr. Smith';
        
        // Check for conflicts unless override is specified
        if (!overrideConflict) {
            console.log('🔍 Checking for conflicts...');
            const conflicts = checkAppointmentConflicts(doctorNameToCheck, appointmentDate, appointmentTime);
            
            if (conflicts.length > 0) {
                console.log('⚠️ Conflict detected:', conflicts);
                const conflictNames = conflicts.map(apt => apt.patient_name).join(', ');
                const conflictMessage = `⚠️ SCHEDULING CONFLICT: ${doctorNameToCheck} already has an appointment with ${conflictNames} on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}.`;
                
                // Return the conflict form with all data preserved
                return res.render('add-appointment', { 
                    message: conflictMessage,
                    showConflictOverride: true,
                    formData: {
                        patientName,
                        phone: formattedPhone,
                        email: email || '',
                        appointmentDate,
                        appointmentTime,
                        doctorName: doctorNameToCheck,
                        practiceName: practiceName || 'Your Practice',
                        appointmentType: appointmentType || 'General Checkup',
                        preVisitChecklist: preVisitChecklist || ''
                    }
                });
            }
        } else {
            console.log('✅ Override confirmed, proceeding with conflicting appointment');
        }
        
        // Proceed with adding the appointment
        console.log('💾 Adding appointment to database...');
        
        // Fix timezone issue - keep the date as entered
        const fixedDate = appointmentDate; // Keep the date string as-is (YYYY-MM-DD)
        
        const appointmentId = addAppointment({
            patientName,
            phone: formattedPhone,
            email: email || '',
            appointmentDate: fixedDate,
            appointmentTime,
            doctorName: doctorNameToCheck,
            practiceName: practiceName || 'Your Practice',
            appointmentType: appointmentType || 'General Checkup',
            preVisitChecklist: preVisitChecklist || ''
        });
        
        const successMessage = overrideConflict ? 
            '✅ Appointment added successfully (conflict override)!' : 
            '✅ Appointment added successfully!';
        
        console.log('✅ Appointment added successfully, ID:', appointmentId);
        res.redirect(`/?message=${encodeURIComponent(successMessage)}`);
        
    } catch (error) {
        console.error('❌ Error adding appointment:', error);
        res.render('add-appointment', { 
            message: 'Error adding appointment. Please try again.',
            showConflictOverride: false,
            formData: req.body
        });
    }
});

// Edit appointment page
app.get('/edit/:id', (req, res) => {
    try {
        const { id } = req.params;
        const appointment = getAppointmentById(id);
        
        if (!appointment) {
            return res.redirect('/?message=Appointment not found');
        }
        
        res.render('edit-appointment', { 
            appointment,
            message: null 
        });
    } catch (error) {
        console.error('Error loading edit page:', error);
        res.redirect('/?message=Error loading appointment');
    }
});

// Handle updating appointment
app.post('/edit/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { patientName, phone, email, appointmentDate, appointmentTime, doctorName, practiceName, appointmentType, preVisitChecklist, sendUpdateNotification, overrideConflict } = req.body;
        
        // Basic validation
        if (!patientName || !phone || !appointmentDate || !appointmentTime) {
            const appointment = getAppointmentById(id);
            return res.render('edit-appointment', { 
                appointment,
                message: 'Please fill in all required fields' 
            });
        }
        
        // Get original appointment for comparison
        const originalAppointment = getAppointmentById(id);
        const doctorNameToCheck = doctorName || 'Dr. Smith';
        
        // Check for conflicts unless override is specified (and something actually changed)
        if (!overrideConflict) {
            const hasTimeChange = originalAppointment.appointment_date !== appointmentDate || 
                                 originalAppointment.appointment_time !== appointmentTime ||
                                 originalAppointment.doctor_name !== doctorNameToCheck;
                                 
            if (hasTimeChange) {
                const conflicts = checkAppointmentConflicts(doctorNameToCheck, appointmentDate, appointmentTime, id);
                
                if (conflicts.length > 0) {
                    const conflictNames = conflicts.map(apt => apt.patient_name).join(', ');
                    const conflictMessage = `⚠️ SCHEDULING CONFLICT: ${doctorNameToCheck} already has an appointment with ${conflictNames} on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}. Update anyway?`;
                    
                    return res.render('edit-appointment', { 
                        appointment: originalAppointment,
                        message: conflictMessage,
                        showConflictOverride: true,
                        formData: {
                            patientName,
                            phone,
                            email: email || '',
                            appointmentDate,
                            appointmentTime,
                            doctorName: doctorNameToCheck,
                            practiceName: practiceName || 'Your Practice',
                            appointmentType: appointmentType || 'General Checkup',
                            preVisitChecklist: preVisitChecklist || '',
                            sendUpdateNotification
                        }
                    });
                }
            }
        }
        
        // Format phone number (add +1 if not present)
        let formattedPhone = phone.replace(/\D/g, ''); // Remove non-digits
        if (formattedPhone.length === 10) {
            formattedPhone = '+1' + formattedPhone;
        } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
            formattedPhone = '+' + formattedPhone;
        } else {
            formattedPhone = phone; // Keep original if can't format
        }
        
        const success = updateAppointment(id, {
            patientName,
            phone: formattedPhone,
            email: email || '',
            appointmentDate,
            appointmentTime,
            doctorName: doctorNameToCheck,
            practiceName: practiceName || 'Your Practice',
            appointmentType: appointmentType || 'General Checkup',
            preVisitChecklist: preVisitChecklist || ''
        });
        
        if (success) {
            // Send update notification if requested
            if (sendUpdateNotification) {
                try {
                    const { sendAppointmentUpdateSMS } = require('./appointmentUpdateNotifications');
                    const updatedAppointment = getAppointmentById(id);
                    await sendAppointmentUpdateSMS(updatedAppointment);
                    console.log(`✅ Update notification sent to ${patientName}`);
                } catch (error) {
                    console.error(`❌ Failed to send update notification: ${error.message}`);
                    // Don't fail the update if notification fails
                }
            }
            
            const successMessage = overrideConflict ? 
                'Appointment updated successfully (conflict override)!' : 
                'Appointment updated successfully!';
            
            res.redirect(`/?message=${encodeURIComponent(successMessage)}`);
        } else {
            const appointment = getAppointmentById(id);
            res.render('edit-appointment', { 
                appointment,
                message: 'Error updating appointment. Please try again.' 
            });
        }
    } catch (error) {
        console.error('Error updating appointment:', error);
        res.redirect('/?message=Error updating appointment');
    }
});

// View appointments for specific date
app.get('/date/:date', (req, res) => {
    try {
        const { date } = req.params;
        const appointments = getAppointmentsByDate(date);
        
        res.render('appointments-by-date', { 
            appointments,
            date,
            formattedDate: new Date(date).toLocaleDateString()
        });
    } catch (error) {
        console.error('Error loading appointments by date:', error);
        res.status(500).send('Error loading appointments');
    }
});

// Delete appointment
app.post('/delete/:id', (req, res) => {
    try {
        const { id } = req.params;
        const success = deleteAppointment(id);
        
        if (success) {
            res.redirect('/?message=Appointment deleted successfully!');
        } else {
            res.redirect('/?message=Error deleting appointment');
        }
    } catch (error) {
        console.error('Error deleting appointment:', error);
        res.redirect('/?message=Error deleting appointment');
    }
});

// API endpoint to get appointments (for future use)
app.get('/api/appointments', (req, res) => {
    try {
        const appointments = getAllAppointments();
        res.json(appointments);
    } catch (error) {
        console.error('Error getting appointments:', error);
        res.status(500).json({ error: 'Error getting appointments' });
    }
});

// Webhook endpoint for incoming SMS confirmations
app.post('/webhook/sms', express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const { From, Body } = req.body;
        
        console.log(`📨 Webhook received - From: ${From}, Body: "${Body}"`);
        
        // Handle the confirmation
        const result = await handleIncomingConfirmation(From, Body);
        
        if (result.success) {
            // Respond with TwiML (Twilio's XML format for responses)
            res.type('text/xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <!-- Auto-response already sent by handleIncomingConfirmation -->
                </Response>`);
        } else {
            // Send a generic "didn't understand" message
            res.type('text/xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Message>We received your message but couldn't find an upcoming appointment. Please call us if you need assistance.</Message>
                </Response>`);
        }
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(500).type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Message>Sorry, there was an error processing your message. Please call us directly.</Message>
            </Response>`);
    }
});

// Test endpoint for confirmations (for development)
app.post('/test-confirmation', async (req, res) => {
    try {
        const { phone, message } = req.body;
        const result = await handleIncomingConfirmation(phone, message);
        res.json(result);
    } catch (error) {
        console.error('❌ Test confirmation error:', error);
        res.status(500).json({ error: 'Failed to test confirmation' });
    }
});

// API endpoint to trigger reminders manually (for testing)
app.post('/api/send-reminders', async (req, res) => {
    try {
        // Import the reminder function
        const { processReminders } = require('./reminder');
        await processReminders();
        res.json({ success: true, message: 'Reminders processed' });
    } catch (error) {
        console.error('Error processing reminders:', error);
        res.status(500).json({ error: 'Error processing reminders' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Appointment Reminder Dashboard running on http://localhost:${PORT}`);
    console.log('📊 Open your browser and go to the URL above to manage appointments!');
});

module.exports = app;