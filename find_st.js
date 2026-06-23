const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./src/data/provinces.json', 'utf8'));

const tinh = data.find(p => p.name.includes('Sóc Trăng'));
if (tinh) {
  const huyen = tinh.districts.find(d => d.name.includes('Thạnh Trị'));
  if (huyen) {
    const xa = huyen.wards.find(w => w.name.includes('Hưng Lợi'));
    console.log('Tinh:', tinh.code, tinh.name);
    console.log('Huyen:', huyen.code, huyen.name);
    if (xa) console.log('Xa:', xa.code, xa.name);
    else console.log('Xa Hưng Lợi not found');
  } else console.log('Huyen Thạnh Trị not found');
} else console.log('Tinh Sóc Trăng not found');
