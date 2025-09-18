const XLSX = require('xlsx');

// Create test data
const testData = [
  ['Latitude', 'Longitude', 'Address'],
  [4.6097, -74.0817, 'Bogotá Centro']
];

const worksheet = XLSX.utils.aoa_to_sheet(testData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

// Convert to JSON to see the structure
const jsonData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: null,
  blankrows: false
});

console.log('Raw data:', jsonData);
console.log('Headers:', jsonData[0]);
console.log('First row:', jsonData[1]);