// Test the exact pagination logic from InvoiceView.tsx
function testPagination(itemCount, isA5, hasSerial) {
  const items = Array.from({ length: itemCount }, (_, idx) => ({
    name: `Item Product #${idx + 1} - Standard Hardware/Pharma Item`,
    qty: 1,
    price: 1000 + idx * 50,
    subLines: hasSerial ? [`Serial: SN-TEST-2026-${1000 + idx}`, `Batch: BT-99${idx}`] : []
  }));

  const getItemHeight = (it) => {
    const base = isA5 ? 18 : 24;
    const subHeight = isA5 ? 11 : 14;
    const subCount = Array.isArray(it.subLines) ? it.subLines.length : 0;
    const nameLen = (it.name || '').length;
    let extraName = 0;
    if (nameLen > 65) extraName = isA5 ? 16 : 22;
    else if (nameLen > 35) extraName = isA5 ? 8 : 11;
    return base + (subCount * subHeight) + extraName;
  };

  const estBottomSummaryHeight = isA5 ? 170 : 290;
  const maxLastPageHeight = isA5
    ? Math.max(80, Math.floor(525 - 130 - estBottomSummaryHeight))
    : Math.max(180, Math.floor(1060 - 195 - estBottomSummaryHeight));
  const maxNonLastPageHeight = isA5
    ? Math.max(140, Math.floor(525 - 130 - 24))
    : Math.max(300, Math.floor(1060 - 195 - 28));

  const itemPages = [];
  const totalItemsHeight = items.reduce((acc, it) => acc + getItemHeight(it), 0);

  if (totalItemsHeight <= maxLastPageHeight) {
    itemPages.push(items);
  } else {
    let remaining = [...items];
    while (remaining.length > 0) {
      const remainingHeight = remaining.reduce((acc, it) => acc + getItemHeight(it), 0);
      if (remainingHeight <= maxLastPageHeight) {
        itemPages.push(remaining);
        break;
      }

      let currentSlice = [];
      let currentHeight = 0;

      for (let i = 0; i < remaining.length; i++) {
        const it = remaining[i];
        const itH = getItemHeight(it);

        if (currentSlice.length > 0 && currentHeight + itH > maxNonLastPageHeight) {
          break;
        }

        const itemsLeft = remaining.length - (i + 1);
        if (itemsLeft > 0 && itemsLeft < 2 && currentSlice.length >= 2) {
          break;
        }

        currentSlice.push(it);
        currentHeight += itH;
      }

      if (currentSlice.length === 0) {
        currentSlice = [remaining[0]];
      }

      itemPages.push(currentSlice);
      remaining = remaining.slice(currentSlice.length);
    }
  }

  return {
    itemCount,
    isA5: isA5 ? 'A5' : 'A4',
    hasSerial,
    totalPages: itemPages.length,
    pageDistribution: itemPages.map((p, idx) => `Page ${idx + 1}: ${p.length} items`)
  };
}

console.log("=== TESTING A4 & A5 INVOICE PAGINATION ===");
console.log(testPagination(15, false, false));
console.log(testPagination(15, false, true));
console.log(testPagination(22, false, false));
console.log(testPagination(22, false, true));
console.log(testPagination(25, false, false));
console.log(testPagination(25, false, true));

console.log("\n=== TESTING A5 SIZE ===");
console.log(testPagination(15, true, false));
console.log(testPagination(15, true, true));
console.log(testPagination(22, true, false));
console.log(testPagination(25, true, true));
