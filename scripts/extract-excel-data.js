const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Map files to departments
const fileDepartmentMap = {
  'SAP Check List - CM  (6.Fep.2025).xlsx': 'CM (Community Management)',
  'SAP Check List - Collection 3 (05.11.2024).xlsx': 'Collection',
  'SAP Check List - Contracts (05.09.2024).xlsx': 'Contracts',
  'SAP Check List - HO (19.11.2024).xlsx': 'HO (Handover)',
  'SAP Check List - Resale & Rental (02.09.2024).xlsx': 'Resale & Rental',
  'SAP Check List - Security (09.02.2025).xlsx': 'Security',
  'SAP Check List - Sports 2 (08.09.2024).xlsx': 'Sports',
  'SAP Check List - TCR 3 (21.10.2024).xlsx': 'TCR',
  'SAP Launch Check List - Customer Care 2 (17.2.2024).xlsx': 'Customer Care',
  'SAP Launch Check List - FM (09.02.2025).xlsx': 'FM (Facilities Management)',
};

// Function to extract WD (Working Days) from text
function extractWD(text) {
  if (!text || typeof text !== 'string') return null;
  
  const wdMatch = text.match(/(\d+)\s*WD/i);
  if (wdMatch) return parseInt(wdMatch[1]);
  
  const dayMatch = text.match(/(\d+)\s*Day/i);
  if (dayMatch) return parseInt(dayMatch[1]);
  
  const sameDayMatch = text.match(/same\s*day/i);
  if (sameDayMatch) return 0;
  
  return null;
}

// Function to clean and normalize text
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().replace(/\s+/g, ' ');
}

// Function to extract ticket types from a sheet
function extractTicketTypes(df, departmentName) {
  const ticketTypes = [];
  
  // Find the header row
  let headerRowIndex = -1;
  let mainTicketCol = -1;
  let requestTypeCol = -1;
  let slaCol = -1;
  
  for (let i = 0; i < Math.min(10, df.length); i++) {
    const row = df[i];
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toLowerCase();
      if (cell.includes('main') && cell.includes('ticket')) {
        mainTicketCol = j;
        headerRowIndex = i;
      }
      if (cell.includes('request') && cell.includes('type')) {
        requestTypeCol = j;
      }
      if (cell.includes('sla') || cell.includes('wd')) {
        slaCol = j;
      }
    }
    if (headerRowIndex !== -1) break;
  }
  
  if (headerRowIndex === -1) {
    console.log(`No header found for ${departmentName}`);
    return ticketTypes;
  }
  
  // Extract ticket types from data rows
  for (let i = headerRowIndex + 1; i < df.length; i++) {
    const row = df[i];
    
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue;
    
    const mainTicket = cleanText(row[mainTicketCol] || '');
    const requestType = cleanText(row[requestTypeCol] || '');
    const sla = cleanText(row[slaCol] || '');
    
    // Skip if no meaningful data
    if (!mainTicket && !requestType) continue;
    
    // Use main ticket type or request type as the ticket type name
    const ticketTypeName = mainTicket || requestType;
    
    // Extract WD from SLA column
    const wd = extractWD(sla);
    
    // Skip if we can't determine WD and no meaningful ticket type
    if (!ticketTypeName || ticketTypeName.length < 3) continue;
    
    // Check if this ticket type already exists
    const existing = ticketTypes.find(t => 
      t.name.toLowerCase() === ticketTypeName.toLowerCase()
    );
    
    if (!existing) {
      ticketTypes.push({
        name: ticketTypeName,
        defaultWD: wd || 5, // Default to 5 WD if not found
        description: requestType && requestType !== ticketTypeName ? requestType : ''
      });
    }
  }
  
  return ticketTypes;
}

// Main extraction function
function extractAllData() {
  const departments = [];
  const excelDir = path.join(__dirname, '..', '..'); // Go up to parent directory where Excel files are
  
  console.log('Starting data extraction...');
  console.log('Looking for Excel files in:', excelDir);
  
  for (const [filename, departmentName] of Object.entries(fileDepartmentMap)) {
    const filePath = path.join(excelDir, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filename}`);
      continue;
    }
    
    try {
      console.log(`Processing: ${filename}`);
      const workbook = XLSX.readFile(filePath);
      
      // Find the requests/tickets sheet
      const sheetNames = workbook.SheetNames;
      const requestSheet = sheetNames.find(name => 
        name.toLowerCase().includes('request') || 
        name.toLowerCase().includes('ticket')
      ) || sheetNames[1] || sheetNames[0];
      
      console.log(`Using sheet: ${requestSheet}`);
      
      const worksheet = workbook.Sheets[requestSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const ticketTypes = extractTicketTypes(jsonData, departmentName);
      
      departments.push({
        name: departmentName,
        ticketTypes: ticketTypes
      });
      
      console.log(`Extracted ${ticketTypes.length} ticket types for ${departmentName}`);
      
    } catch (error) {
      console.error(`Error processing ${filename}:`, error.message);
    }
  }
  
  // Save to JSON file
  const outputPath = path.join(__dirname, '..', 'data', 'departments.json');
  fs.writeFileSync(outputPath, JSON.stringify(departments, null, 2));
  
  console.log(`\nExtraction complete! Found ${departments.length} departments`);
  console.log(`Data saved to: ${outputPath}`);
  
  // Print summary
  departments.forEach(dept => {
    console.log(`\n${dept.name}:`);
    dept.ticketTypes.forEach(type => {
      console.log(`  - ${type.name} (${type.defaultWD} WD)`);
    });
  });
  
  return departments;
}

// Run extraction if called directly
if (require.main === module) {
  extractAllData();
}

module.exports = { extractAllData };
