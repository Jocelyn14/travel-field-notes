import { writeFile } from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const SOURCE = 'C:/Users/BAODI-JIAOYAN/Documents/xwechat_files/half8__e0c7/msg/file/2026-08/意大利2026.xlsx';
const OUTPUT = new URL('../data/imports/italy-2026-workbook.json', import.meta.url);
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

const dateFromSerial = (value) => new Date(EXCEL_EPOCH + Math.trunc(value) * 86_400_000).toISOString().slice(0, 10);
const timeFromSerial = (value) => {
  const minutes = Math.round(Number(value) * 1_440) % 1_440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
const classify = (text) => {
  if (/办理入住|返回酒店休息|返回酒店取行李|休息室/.test(text)) return 'stay';
  if (/^抵达|抵达[^，]*，/.test(text)) return 'arrival';
  if (/搭乘|前往机场|前往.*火车站|乘车前往|公交抵达|返回码头/.test(text)) return 'transit';
  if (/午餐|晚餐|早餐|飞机餐/.test(text)) return 'meal';
  if (/游览|City Walk|购物|SKY BAR|看日落/.test(text)) return 'visit';
  return 'note';
};

const input = await FileBlob.load(SOURCE);
const workbook = await SpreadsheetFile.importXlsx(input);
const rows = workbook.worksheets.getItemAt(0).getUsedRange().values;
const days = [];
let day;

for (const row of rows.slice(1)) {
  const [dateSerial, route, timeSerial, itinerary, meals, accommodation] = row;
  if (Number.isFinite(dateSerial)) {
    day = {
      date: dateFromSerial(dateSerial),
      route: String(route ?? '').trim(),
      accommodation: String(accommodation ?? '').trim(),
      events: [],
    };
    days.push(day);
  }
  if (!day || !itinerary) continue;
  day.events.push({
    time: timeFromSerial(timeSerial),
    itinerary: String(itinerary).trim(),
    meals: String(meals ?? '').trim(),
    type: classify(String(itinerary)),
  });
}

const eventCount = days.reduce((sum, item) => sum + item.events.length, 0);
if (days.length !== 10 || eventCount !== 66) {
  throw new Error(`意大利行程导入数量异常：${days.length} 天 / ${eventCount} 条`);
}

await writeFile(OUTPUT, `${JSON.stringify({ source: '意大利2026.xlsx', days }, null, 2)}\n`, 'utf8');
console.log(`Imported ${days.length} days and ${eventCount} itinerary entries.`);
