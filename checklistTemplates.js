// checklistTemplates.js - Pre-visit checklist templates
const checklistTemplates = {
    "General Checkup": [
        "Bring your insurance card",
        "Arrive 15 minutes early for check-in",
        "Bring a list of current medications",
        "No eating 30 minutes before appointment"
    ],
    
    "Dental Cleaning": [
        "Brush your teeth before coming in",
        "Bring your insurance card",
        "No eating 2 hours before appointment",
        "Arrive 15 minutes early",
        "Bring list of any medications you're taking"
    ],
    
    "Root Canal": [
        "Take ibuprofen 1 hour before appointment",
        "Eat a light meal beforehand (you may be numb after)",
        "Arrange transportation home",
        "Bring insurance card and photo ID",
        "Plan to take the rest of the day off"
    ],
    
    "Surgery/Extraction": [
        "DO NOT eat or drink 8 hours before appointment",
        "Arrange someone to drive you home",
        "Wear comfortable, loose clothing",
        "Remove all jewelry and contact lenses",
        "Bring insurance card and photo ID",
        "Take prescribed pre-medication as directed"
    ],
    
    "Physical Exam": [
        "Bring insurance card and photo ID",
        "Bring list of current medications",
        "Wear comfortable, easy-to-remove clothing",
        "Arrive 15 minutes early for paperwork",
        "Bring any previous test results or records"
    ],
    
    "Blood Work/Lab": [
        "Fast for 12 hours if fasting labs ordered",
        "Drink plenty of water (unless fasting)",
        "Wear short sleeves or sleeves that roll up easily",
        "Bring insurance card and photo ID",
        "Bring lab order form from doctor"
    ],
    
    "Specialist Consultation": [
        "Bring referral from your primary doctor",
        "Bring insurance card and photo ID", 
        "Bring all relevant medical records",
        "Arrive 20 minutes early for new patient paperwork",
        "Prepare list of questions for the doctor"
    ],
    
    "Follow-up Visit": [
        "Bring insurance card",
        "Note any changes in symptoms since last visit",
        "Bring current medications",
        "Arrive 10 minutes early"
    ],
    
    "Orthodontic Adjustment": [
        "Brush and floss thoroughly before appointment",
        "Bring your retainer case",
        "Avoid hard/sticky foods beforehand",
        "Bring insurance card"
    ],
    
    "Eye Exam": [
        "Bring current glasses and contact lenses",
        "Bring insurance card and photo ID",
        "Don't wear eye makeup",
        "Arrange transportation (pupils may be dilated)",
        "Bring sunglasses for after exam"
    ]
};

// Get checklist for appointment type
function getChecklistForType(appointmentType) {
    return checklistTemplates[appointmentType] || checklistTemplates["General Checkup"];
}

// Get all available appointment types
function getAvailableAppointmentTypes() {
    return Object.keys(checklistTemplates);
}

// Format checklist for SMS (compact format)
function formatChecklistForSMS(checklist) {
    if (!checklist || checklist.length === 0) return '';
    
    const items = Array.isArray(checklist) ? checklist : checklist.split('\n').filter(item => item.trim());
    
    return '\n\nPre-visit checklist:\n' + 
           items.map((item, index) => `${index + 1}. ${item.trim()}`).join('\n');
}

// Format checklist for email (HTML format)
function formatChecklistForEmail(checklist) {
    if (!checklist || checklist.length === 0) return '';
    
    const items = Array.isArray(checklist) ? checklist : checklist.split('\n').filter(item => item.trim());
    
    return `
        <div style="margin-top: 20px; padding: 15px; background: #f7fafc; border-radius: 6px;">
            <h3 style="color: #2d3748; margin-top: 0;">📋 Pre-Visit Checklist</h3>
            <ul style="color: #4a5568; margin: 10px 0;">
                ${items.map(item => `<li style="margin-bottom: 5px;">${item.trim()}</li>`).join('')}
            </ul>
        </div>
    `;
}

// Generate custom checklist from template
function generateCustomChecklist(appointmentType, customItems = []) {
    const templateItems = getChecklistForType(appointmentType);
    const allItems = [...templateItems, ...customItems];
    return allItems;
}

module.exports = {
    checklistTemplates,
    getChecklistForType,
    getAvailableAppointmentTypes,
    formatChecklistForSMS,
    formatChecklistForEmail,
    generateCustomChecklist
};