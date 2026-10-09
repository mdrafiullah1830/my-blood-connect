// ei module zero-dependency PDF toiri kore — monthly donation report download er jonno.
// minimal PDF 1.4 structure use kora hoy: header, catalog, pages, font, content stream.

const escapePdfText = (text) => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');

// single/multi-line report theke valid PDF buffer banay.
const buildPdf = ({ title, lines = [], footer = '' }) => {
    const contentLines = [];
    let y = 780;
    contentLines.push('BT /F1 20 Tf 50 ' + y + ' Td (' + escapePdfText(title) + ') Tj ET');
    y -= 34;
    contentLines.push('BT /F2 11 Tf 50 ' + y + ' Td (' + escapePdfText('Generated: ' + new Date().toISOString()) + ') Tj ET');
    y -= 30;
    for (const line of lines) {
        if (y < 60) break;
        contentLines.push('BT /F2 11 Tf 50 ' + y + ' Td (' + escapePdfText(line) + ') Tj ET');
        y -= 18;
    }
    if (footer && y > 60) contentLines.push('BT /F2 9 Tf 50 40 Td (' + escapePdfText(footer) + ') Tj ET');
    const content = contentLines.join('\n');

    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>');
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((obj, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
};

// donor er monthly report data theke PDF lines banay.
const donationReportLines = (donations, summary) => [
    `Donor: ${summary.donorName}`,
    `Blood group: ${summary.bloodGroup}`,
    `Report period: ${summary.period}`,
    '',
    `Total donations in period: ${donations.length}`,
    `Total bags: ${donations.reduce((sum, d) => sum + (d.bags || 1), 0)}`,
    `Lifetime donation count: ${summary.lifetimeCount}`,
    '',
    'Donation details:',
    ...donations.map((d, i) => `${i + 1}. ${new Date(d.donatedAt).toISOString().slice(0, 10)}  ${d.bags} bag(s)  ${d.hospitalName || 'N/A'} (${d.city || 'N/A'})`),
    '',
    'Thank you for saving lives.'
];

module.exports = { buildPdf, donationReportLines, escapePdfText };
