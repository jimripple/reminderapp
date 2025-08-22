// enhancedReminder.js - Multi-time reminder system

require('dotenv').config();

const twilio = require('twilio');
const {
  initializeDatabase,
  getAppointmentsNeeding24hReminders,
  getAppointmentsNeeding4hReminders,
  getAppointmentsNeeding1hReminders,
  markReminderSent
} = require('./appointments');

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Initialize database on startup
initializeDatabase();

// Send SMS reminder with different messages based on timing
async function sendSMSReminder(appointment, reminderType) {
  // Format checklist for SMS
  function formatChecklistForSMS(checklist) {
    if (!checklist) return '';
    const items = checklist.split('\n').filter(item => item && item.trim());
    if (items.length === 0) return '';
    return '\n\nChecklist:\n' + items.map((item, index) => {
      return `${index + 1}. ${item.trim()}`;
    }).join('\n');
  }

  const checklistText = formatChecklistForSMS(appointment.pre_visit_checklist || '');
  let message;

  switch (reminderType) {
    case '24h':
      message = `Hi ${appointment.patient_name}! Reminder: ${appointment.appointment_type} with ${appointment.doctor_name} TOMORROW at ${appointment.appointment_time}. Please arrive 15 minutes early.${checklistText}\n\nReply YES to confirm or NO to cancel. Reply STOP to opt out.`;
      break;
    case '4h':
      message = `Hi ${appointment.patient_name}! Your ${appointment.appointment_type} with ${appointment.doctor_name} is in 4 hours at ${appointment.appointment_time}.${checklistText}\n\nReply YES to confirm you're coming. Reply STOP to opt out.`;
      break;
    case '1h':
      message = `Hi ${appointment.patient_name}! Your ${appointment.appointment_type} with ${appointment.doctor_name} is in 1 HOUR at ${appointment.appointment_time}. Please head over soon!${checklistText}\n\nReply YES if you're on your way. Reply STOP to opt out.`;
      break;
    default:
      message = `Hi ${appointment.patient_name}! Reminder: ${appointment.appointment_type} with ${appointment.doctor_name} at ${appointment.appointment_time}.${checklistText}\n\nReply YES to confirm. Reply STOP to opt out.`;
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: appointment.phone
    });

    console.log(`✅ ${reminderType} reminder sent to ${appointment.patient_name}: ${result.sid}`);

    // Mark reminder as sent in database (await in case it's async)
    await markReminderSent(appointment.id, reminderType);

    return result;
  } catch (error) {
    console.error(`❌ Failed to send ${reminderType} reminder to ${appointment.patient_name}:`, error && error.message ? error.message : error);
    return null;
  }
}

// Process 24-hour reminders
async function process24hReminders() {
  console.log('🔍 Checking for 24-hour reminders...');

  const appointments = (await getAppointmentsNeeding24hReminders()) || [];

  if (appointments.length === 0) {
    console.log('📅 No 24-hour reminders needed');
    return { sent: 0, failed: 0 };
  }

  console.log(`📱 Found ${appointments.length} appointments needing 24-hour reminders`);

  let sent = 0, failed = 0;

  for (const appointment of appointments) {
    const result = await sendSMSReminder(appointment, '24h');
    if (result) {
      sent++;
    } else {
      failed++;
    }
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ 24-hour reminders: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// Process 4-hour reminders
async function process4hReminders() {
  console.log('🔍 Checking for 4-hour reminders...');

  const appointments = (await getAppointmentsNeeding4hReminders()) || [];

  if (appointments.length === 0) {
    console.log('📅 No 4-hour reminders needed');
    return { sent: 0, failed: 0 };
  }

  console.log(`📱 Found ${appointments.length} appointments needing 4-hour reminders`);

  let sent = 0, failed = 0;

  for (const appointment of appointments) {
    const result = await sendSMSReminder(appointment, '4h');
    if (result) {
      sent++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ 4-hour reminders: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// Process 1-hour reminders
async function process1hReminders() {
  console.log('🔍 Checking for 1-hour reminders...');

  const appointments = (await getAppointmentsNeeding1hReminders()) || [];

  if (appointments.length === 0) {
    console.log('📅 No 1-hour reminders needed');
    return { sent: 0, failed: 0 };
  }

  console.log(`📱 Found ${appointments.length} appointments needing 1-hour reminders`);

  let sent = 0, failed = 0;

  for (const appointment of appointments) {
    const result = await sendSMSReminder(appointment, '1h');
    if (result) {
      sent++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`✅ 1-hour reminders: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

// Process all reminder types
async function processAllReminders() {
  console.log('🚀 Starting enhanced reminder processing...');

  const results = {
    '24h': await process24hReminders(),
    '4h': await process4hReminders(),
    '1h': await process1hReminders()
  };

  const totalSent = results['24h'].sent + results['4h'].sent + results['1h'].sent;
  const totalFailed = results['24h'].failed + results['4h'].failed + results['1h'].failed;

  console.log(`🎉 Enhanced reminder processing complete!`);
  console.log(`📊 Total: ${totalSent} sent, ${totalFailed} failed`);

  return results;
}

// Get current time for debugging
function getCurrentTime() {
  return new Date().toLocaleString();
}

// Check what reminders would be sent (dry run)
function checkUpcomingReminders() {
  console.log(`📋 Reminder Check at ${getCurrentTime()}`);

  // call the same functions; allow them to return arrays or promises
  const upcoming24h = (getAppointmentsNeeding24hReminders()) || [];
  const upcoming4h = (getAppointmentsNeeding4hReminders()) || [];
  const upcoming1h = (getAppointmentsNeeding1hReminders()) || [];

  // If the appointment getters are async and return promises, warn user to use the CLI flags instead
  if (typeof upcoming24h.then === 'function' || typeof upcoming4h.then === 'function' || typeof upcoming1h.then === 'function') {
    console.log('ℹ️ The appointment getter functions appear to be async. Use the CLI --check flag when running the script so async getters resolve correctly.');
    return {};
  }

  console.log(`24-hour reminders due: ${upcoming24h.length}`);
  console.log(`4-hour reminders due: ${upcoming4h.length}`);
  console.log(`1-hour reminders due: ${upcoming1h.length}`);

  return {
    '24h': upcoming24h.length,
    '4h': upcoming4h.length,
    '1h': upcoming1h.length
  };
}

// Run the script
if (require.main === module) {
  // You can run specific reminder types or all
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    // If the getters are async, run a simple async check
    (async () => {
      const maybeAsync24 = await getAppointmentsNeeding24hReminders();
      const maybeAsync4 = await getAppointmentsNeeding4hReminders();
      const maybeAsync1 = await getAppointmentsNeeding1hReminders();

      console.log(`📋 Reminder Check at ${getCurrentTime()}`);
      console.log(`24-hour reminders due: ${maybeAsync24 ? maybeAsync24.length : 0}`);
      console.log(`4-hour reminders due: ${maybeAsync4 ? maybeAsync4.length : 0}`);
      console.log(`1-hour reminders due: ${maybeAsync1 ? maybeAsync1.length : 0}`);
    })().catch(console.error);
  } else if (args.includes('--24h')) {
    process24hReminders().catch(console.error);
  } else if (args.includes('--4h')) {
    process4hReminders().catch(console.error);
  } else if (args.includes('--1h')) {
    process1hReminders().catch(console.error);
  } else {
    processAllReminders().catch(console.error);
  }
}

module.exports = {
  processAllReminders,
  process24hReminders,
  process4hReminders,
  process1hReminders,
  checkUpcomingReminders,
  sendSMSReminder
};