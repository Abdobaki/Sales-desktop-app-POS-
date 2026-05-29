const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/app/components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace DZ with DZD in format functions
  content = content.replace(/amount\.toFixed\(2\)} DZ`/g, 'amount.toFixed(2)} DZD`');
  
  // Replace Currency: DZ with Currency: DZD
  content = content.replace(/Currency: DZ/g, 'Currency: DZD');

  // Replace 'DZ' with 'DZD' in Reports and Suppliers
  content = content.replace(/\? 'DZ' :/g, "? 'DZD' :");
  
  // In CustomersView.tsx: Replace ${...} with {...} DZD
  if (f === 'CustomersView.tsx') {
    content = content.replace(/\$\{customer\.totalSpent\.toFixed\(2\)\}/g, '{customer.totalSpent.toFixed(2)} DZD');
  }

  // In POSView.tsx: remove $ prefix from formatting
  if (f === 'POSView.tsx') {
    content = content.replace(/<span>\$\$\{formatDz/g, '<span>${formatDz');
  }

  if (original !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + f);
  }
});

const sharedFile = path.join(dir, 'data', 'shared.ts');
if (fs.existsSync(sharedFile)) {
  let content = fs.readFileSync(sharedFile, 'utf8');
  let original = content;
  content = content.replace(/amount\.toFixed\(2\)} DZ`/g, 'amount.toFixed(2)} DZD`');
  if (original !== content) {
    fs.writeFileSync(sharedFile, content, 'utf8');
    console.log('Updated shared.ts');
  }
}
