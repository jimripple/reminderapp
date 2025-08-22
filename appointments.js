// appointments-simple.js - JSON file-based database (no SQLite dependencies)
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'appointments.json');

// Initialize database file if it doesn't exist
function initializeDatabase() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
        console.log('✅ Database initialized (JSON file)');
    } else {
        console.log('✅ Database loaded (JSON file)');
    }
}

// Read all appointments from file
function readAppointments() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading appointments:', error);
        return [];
    }
}

// Write appointments to file
function writeAppointments(appointments) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(appointments, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing appointments:', error);
        return false;
    }
}

// Helper function to standardize time format
function formatTime(timeInput) {
    if (!timeInput) return timeInput;
    
    // Remove extra spaces and convert to uppercase
    let time = timeInput.trim().toUpperCase();
    
    // Handle various input formats
    // Convert "930am" or "930" to "9:30 AM"
    if (/^\d{3,4}[AP]?M?$/i.test(time)) {
        let digits = time.replace(/[AP]M/i, '');
        let ampm = time.includes('P') ? 'PM' : 'AM';
        
        if (digits.length === 3) {
            // "930" -> "9:30"
            let hour = digits[0];
            let minutes = digits.slice(1);
            
            // Validate minutes
            if (parseInt(minutes) > 59) {
                return timeInput; // Return original if invalid
            }
            
            time = hour + ':' + minutes + ' ' + ampm;
        } else if (digits.length === 4) {
            // "1030" -> "10:30" 
            let hour = digits.slice(0, 2);
            let minutes = digits.slice(2);
            
            // Validate hour and minutes
            if (parseInt(hour) > 12 || parseInt(minutes) > 59) {
                return timeInput; // Return original if invalid
            }
            
            time = hour + ':' + minutes + ' ' + ampm;
        }
    }
    
    // Handle "9:30am" -> "9:30 AM"
    time = time.replace(/(\d{1,2}:\d{2})\s*([AP]M)/i, '$1 $2');
    
    // Handle "9am" -> "9:00 AM"
    time = time.replace(/^(\d{1,2})\s*([AP]M)$/i, '$1:00 $2');
    
    // Handle "9:30" (add AM if no AM/PM specified and before 12)
    if (/^\d{1,2}:\d{2}$/.test(time)) {
        const [hourStr, minuteStr] = time.split(':');
        const hour = parseInt(hourStr);
        const minutes = parseInt(minuteStr);
        
        // Validate hour and minutes
        if (hour > 12 || minutes > 59) {
            return timeInput; // Return original if invalid
        }
        
        time = time + (hour < 12 ? ' AM' : ' PM');
    }
    
    // Handle "9" (add :00 AM/PM)
    if (/^\d{1,2}$/.test(time)) {
        const hour = parseInt(time);
        
        // Validate hour
        if (hour > 12) {
            return timeInput; // Return original if invalid
        }
        
        time = hour + ':00 ' + (hour < 12 ? 'AM' : 'PM');
    }
    
    // Final validation: check if we have a valid time format
    const timeRegex = /^(\d{1,2}):(\d{2})\s+(AM|PM)$/;
    const match = time.match(timeRegex);
    
    if (match) {
        const hour = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        
        // Validate ranges
        if (hour < 1 || hour > 12 || minutes > 59) {
            return timeInput; // Return original if invalid
        }
    }
    
    // Ensure proper AM/PM format
    time = time.replace(/\s*AM/i, ' AM').replace(/\s*PM/i, ' PM');
    
    return time;
}

// Add a new appointment
function addAppointment(appointmentData) {
    const appointments = readAppointments();
    
    const newAppointment = {
        id: appointments.length > 0 ? Math.max(...appointments.map(a => a.id)) + 1 : 1,
        patient_name: appointmentData.patientName,
        phone: appointmentData.phone,
        email: appointmentData.email || '',
        appointment_date: appointmentData.appointmentDate,
        appointment_time: formatTime(appointmentData.appointmentTime),
        doctor_name: appointmentData.doctorName || 'Dr. Smith',
        practice_name: appointmentData.practiceName || 'Your Practice',
        appointment_type: appointmentData.appointmentType || 'General Checkup', // New field
        pre_visit_checklist: appointmentData.preVisitChecklist || '', // New field
        // Track different reminder types
        reminder_24h_sent: false,
        reminder_4h_sent: false,
        reminder_1h_sent: false,
        email_reminder_sent: false,
        // Track confirmation status
        confirmation_status: 'pending',
        confirmation_received_at: null,
        confirmation_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    appointments.push(newAppointment);
    
    if (writeAppointments(appointments)) {
        console.log(`✅ Added appointment for ${appointmentData.patientName} - ID: ${newAppointment.id}`);
        return newAppointment.id;
    } else {
        throw new Error('Failed to save appointment');
    }
}

// Get appointments that need 24h reminders
function getAppointmentsNeeding24hReminders() {
    const appointments = readAppointments();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return appointments.filter(apt => 
        apt.appointment_date === tomorrowStr && !apt.reminder_24h_sent
    );
}

// Get appointments that need 4h reminders
function getAppointmentsNeeding4hReminders() {
    const appointments = readAppointments();
    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + (4 * 60 * 60 * 1000));
    
    return appointments.filter(apt => {
        const appointmentDateTime = new Date(`${apt.appointment_date}T${convertTo24Hour(apt.appointment_time)}`);
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        
        // Check if appointment is between 3.5 and 4.5 hours away and reminder not sent
        return timeDiff > 3.5 * 60 * 60 * 1000 && 
               timeDiff < 4.5 * 60 * 60 * 1000 && 
               !apt.reminder_4h_sent;
    });
}

// Get appointments that need 1h reminders
function getAppointmentsNeeding1hReminders() {
    const appointments = readAppointments();
    const now = new Date();
    
    return appointments.filter(apt => {
        const appointmentDateTime = new Date(`${apt.appointment_date}T${convertTo24Hour(apt.appointment_time)}`);
        const timeDiff = appointmentDateTime.getTime() - now.getTime();
        
        // Check if appointment is between 0.5 and 1.5 hours away and reminder not sent
        return timeDiff > 0.5 * 60 * 60 * 1000 && 
               timeDiff < 1.5 * 60 * 60 * 1000 && 
               !apt.reminder_1h_sent;
    });
}

// Helper function to convert 12-hour time to 24-hour format
function convertTo24Hour(time12h) {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
        hours = '00';
    }
    
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    
    return `${hours}:${minutes}:00`;
}

// Mark specific reminder type as sent
function markReminderSent(appointmentId, reminderType = '24h') {
    const appointments = readAppointments();
    const appointment = appointments.find(apt => apt.id === appointmentId);
    
    if (appointment) {
        switch (reminderType) {
            case '24h':
                appointment.reminder_24h_sent = true;
                break;
            case '4h':
                appointment.reminder_4h_sent = true;
                break;
            case '1h':
                appointment.reminder_1h_sent = true;
                break;
        }
        appointment.updated_at = new Date().toISOString();
        return writeAppointments(appointments);
    }
    
    return false;
}

// Legacy function for backwards compatibility
function getAppointmentsNeedingReminders() {
    return getAppointmentsNeeding24hReminders();
}

// Get all appointments
function getAllAppointments() {
    return readAppointments().sort((a, b) => {
        // Sort by date, then by time
        if (a.appointment_date !== b.appointment_date) {
            return new Date(a.appointment_date) - new Date(b.appointment_date);
        }
        return a.appointment_time.localeCompare(b.appointment_time);
    });
}

// Get appointments for a specific date
function getAppointmentsByDate(date) {
    const appointments = readAppointments();
    return appointments
        .filter(apt => apt.appointment_date === date)
        .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
}

// Get a single appointment by ID
function getAppointmentById(id) {
    const appointments = readAppointments();
    return appointments.find(apt => apt.id === parseInt(id));
}

// Update an appointment
function updateAppointment(id, updatedData) {
    const appointments = readAppointments();
    const appointmentIndex = appointments.findIndex(apt => apt.id === parseInt(id));
    
    if (appointmentIndex === -1) {
        return false;
    }
    
    // Update the appointment while preserving original data
    appointments[appointmentIndex] = {
        ...appointments[appointmentIndex],
        patient_name: updatedData.patientName,
        phone: updatedData.phone,
        email: updatedData.email || appointments[appointmentIndex].email || '',
        appointment_date: updatedData.appointmentDate,
        appointment_time: formatTime(updatedData.appointmentTime),
        doctor_name: updatedData.doctorName,
        practice_name: updatedData.practiceName,
        appointment_type: updatedData.appointmentType || appointments[appointmentIndex].appointment_type || 'General Checkup',
        pre_visit_checklist: updatedData.preVisitChecklist || appointments[appointmentIndex].pre_visit_checklist || '',
        updated_at: new Date().toISOString()
    };
    
    if (writeAppointments(appointments)) {
        console.log(`✅ Updated appointment for ${updatedData.patientName} - ID: ${id}`);
        return true;
    }
    
    return false;
}

// Update appointment confirmation status
function updateAppointmentConfirmation(phone, status, message) {
    const appointments = readAppointments();
    
    // Find the most recent upcoming appointment for this phone number
    const now = new Date();
    const upcomingAppointments = appointments.filter(apt => {
        const appointmentDate = new Date(apt.appointment_date);
        return apt.phone === phone && appointmentDate >= now;
    }).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    
    if (upcomingAppointments.length === 0) {
        return null; // No upcoming appointments found
    }
    
    const appointment = upcomingAppointments[0];
    appointment.confirmation_status = status;
    appointment.confirmation_received_at = new Date().toISOString();
    appointment.confirmation_message = message;
    appointment.updated_at = new Date().toISOString();
    
    if (writeAppointments(appointments)) {
        console.log(`✅ Updated confirmation for ${appointment.patient_name}: ${status}`);
        return appointment;
    }
    
    return null;
}

// Get appointments by confirmation status
function getAppointmentsByConfirmationStatus(status) {
    const appointments = readAppointments();
    return appointments.filter(apt => apt.confirmation_status === status);
}

// Get appointment by phone number (most recent upcoming)
function getUpcomingAppointmentByPhone(phone) {
    const appointments = readAppointments();
    const now = new Date();
    
    const upcomingAppointments = appointments.filter(apt => {
        const appointmentDate = new Date(apt.appointment_date);
        return apt.phone === phone && appointmentDate >= now;
    }).sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    
    return upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;
}

// Check for appointment conflicts (same doctor, same date/time)
function checkAppointmentConflicts(doctorName, appointmentDate, appointmentTime, excludeId = null) {
    const appointments = readAppointments();
    
    const conflicts = appointments.filter(apt => {
        // Skip the appointment being edited (for updates)
        if (excludeId && apt.id === parseInt(excludeId)) {
            return false;
        }
        
        // Check for same doctor, date, and time
        return apt.doctor_name === doctorName && 
               apt.appointment_date === appointmentDate && 
               apt.appointment_time === appointmentTime;
    });
    
    return conflicts;
}

// Get appointments by doctor for a specific date
function getAppointmentsByDoctorAndDate(doctorName, appointmentDate) {
    const appointments = readAppointments();
    
    return appointments.filter(apt => 
        apt.doctor_name === doctorName && 
        apt.appointment_date === appointmentDate
    ).sort((a, b) => {
        // Sort by time
        const timeA = convertTo24Hour(a.appointment_time);
        const timeB = convertTo24Hour(b.appointment_time);
        return timeA.localeCompare(timeB);
    });
}

// Mark email reminder as sent
function markEmailReminderSent(appointmentId) {
    const appointments = readAppointments();
    const appointment = appointments.find(apt => apt.id === appointmentId);
    
    if (appointment) {
        appointment.email_reminder_sent = true;
        appointment.updated_at = new Date().toISOString();
        return writeAppointments(appointments);
    }
    
    return false;
}

// Get appointments that need email reminders
function getAppointmentsNeedingEmailReminders() {
    const appointments = readAppointments();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    return appointments.filter(apt => 
        apt.appointment_date === tomorrowStr && 
        !apt.email_reminder_sent && 
        apt.email && 
        apt.email.trim() !== ''
    );
}

// Delete an appointment
function deleteAppointment(id) {
    const appointments = readAppointments();
    const filteredAppointments = appointments.filter(apt => apt.id !== parseInt(id));
    
    if (filteredAppointments.length < appointments.length) {
        return writeAppointments(filteredAppointments);
    }
    
    return false;
}

// Add some sample data for testing
function addSampleData() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterStr = dayAfter.toISOString().split('T')[0];
    
    const sampleAppointments = [
        {
            patientName: "John Doe",
            phone: "+17346524500", // Your phone number for testing
            appointmentDate: tomorrowStr,
            appointmentTime: "10:00 AM",
            doctorName: "Dr. Smith",
            practiceName: "Smile Dental"
        },
        {
            patientName: "Jane Wilson",
            phone: "+17346524500", // Your phone number for testing
            appointmentDate: dayAfterStr,
            appointmentTime: "2:30 PM",
            doctorName: "Dr. Johnson",
            practiceName: "Smile Dental"
        },
        {
            patientName: "Bob Brown",
            phone: "+17346524500", // Your phone number for testing
            appointmentDate: tomorrowStr,
            appointmentTime: "3:00 PM",
            doctorName: "Dr. Lee",
            practiceName: "Smile Dental"
        }
    ];
    
    sampleAppointments.forEach(appointment => {
        addAppointment(appointment);
    });
    
    console.log('✅ Sample data added');
}

module.exports = {
    initializeDatabase,
    addAppointment,
    getAppointmentsNeedingReminders,
    getAppointmentsNeeding24hReminders,
    getAppointmentsNeeding4hReminders,
    getAppointmentsNeeding1hReminders,
    getAppointmentsNeedingEmailReminders,
    markReminderSent,
    markEmailReminderSent,
    getAllAppointments,
    getAppointmentsByDate,
    getAppointmentById,
    checkAppointmentConflicts,
    getAppointmentsByDoctorAndDate,
    updateAppointment,
    updateAppointmentConfirmation,
    getAppointmentsByConfirmationStatus,
    getUpcomingAppointmentByPhone,
    deleteAppointment,
    addSampleData
};