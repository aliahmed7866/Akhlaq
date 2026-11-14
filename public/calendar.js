const stamp = value => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g, '');
const escapeText = value => value.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n');

function folded(line) {
  const encoder = new TextEncoder();
  const lines = [''];
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      lines.push(' ');
      bytes = 1;
    }
    lines[lines.length - 1] += character;
    bytes += length;
  }
  return lines.join('\r\n');
}

export function makeCalendar(days, selectedPrayers, title, lead, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Akhlaq//Prayer times//EN', 'CALSCALE:GREGORIAN'];
  for (const { date, times } of days) {
    for (const [key, label] of selectedPrayers) {
      if (!times[key] || Date.parse(times[key]) <= +now) continue;
      lines.push('BEGIN:VEVENT', 'UID:akhlaq-' + key + '-' + date + '@akhlaq.local', 'DTSTAMP:' + stamp(now),
        'DTSTART:' + stamp(times[key]), 'SUMMARY:' + label + ' prayer',
        'DESCRIPTION:' + escapeText(title + ' • Calculated prayer start'), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:' + (lead ? '-PT' + lead + 'M' : 'PT0M'),
        'DESCRIPTION:' + label + ' prayer', 'END:VALARM', 'END:VEVENT');
    }
  }
  return [...lines, 'END:VCALENDAR', ''].map(folded).join('\r\n');
}

export function downloadFile(name, content, type) {
  if (window.AkhlaqNative) return window.AkhlaqNative.exportFile(name, content, type);
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
