"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMessagePrice = calculateMessagePrice;
function calculateMessagePrice(message, priority = false) {
    const basePrice = 500; // Base fee in satoshis
    const sizeFactor = Math.ceil(Buffer.byteLength(message, 'utf8') / 1024) * 50; // 50 satoshis per KB
    const priorityFee = priority ? 200 : 0; // Additional fee for priority messages
    return basePrice + sizeFactor + priorityFee;
}
//# sourceMappingURL=payment.js.map