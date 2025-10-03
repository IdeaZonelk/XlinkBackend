const Handlebars = require("handlebars");
const moment = require("moment-timezone");
const { formatToSriLankaTime } = require("../utils/timeZone");

Handlebars.registerHelper("formatCurrency", function (number) {
  if (isNaN(number)) return "0.00";
  const [integerPart, decimalPart] = parseFloat(number).toFixed(2).split(".");
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formattedInteger}.${decimalPart}`;
});

Handlebars.registerHelper("countProducts", function (products) {
  return products?.length || 0;
});

Handlebars.registerHelper("addOne", function (index) {
  return index + 1;
});

Handlebars.registerHelper("multiply", function (a, b) {
  if (isNaN(a) || isNaN(b)) return "0.00";
  return (a * b).toFixed(2);
});

Handlebars.registerHelper("formatPoints", function (number) {
  if (isNaN(number)) return "0.00";
  return parseFloat(number).toFixed(2);
});

Handlebars.registerHelper("getDisplayPrice", function (price, discount, taxRate, taxType) {
  console.log("DEBUG getDisplayPrice PARAMS:", { price, discount, taxRate, taxType });
  
  if (isNaN(price)) return "0.00";
  const p = parseFloat(price) || 0;
  const d = parseFloat(discount) || 0;
  const t = parseFloat(taxRate) || 0;
  
  console.log("DEBUG getDisplayPrice PARSED:", { p, d, t });
  
  // Handle undefined/null taxType by defaulting to exclusive
  const normalizedTaxType = (taxType || 'exclusive').toString().toLowerCase().trim();
  console.log("DEBUG normalizedTaxType:", normalizedTaxType);
  
  if (normalizedTaxType === 'inclusive') {
    // For inclusive tax: display the final price (price already includes tax)
    // Just subtract discount
    const displayPrice = p - d;
    console.log("DEBUG inclusive display price:", p, "-", d, "=", displayPrice);
    return displayPrice.toFixed(2);
  } else {
    // For exclusive tax: display price after discount AND tax
    const priceAfterDiscount = p - d;
    const taxAmount = p * t;
    const displayPrice = priceAfterDiscount + taxAmount;
    console.log("DEBUG exclusive display price (after discount + tax):", p, "-", d, "+ tax", taxAmount, "=", displayPrice);
    return displayPrice.toFixed(2);
  }
});

Handlebars.registerHelper("finalPrice", function (price, discount, taxRate, taxType) {
  console.log("DEBUG finalPrice PARAMS:", { price, discount, taxRate, taxType });
  
  if (isNaN(price)) return "0.00";
  const p = parseFloat(price) || 0;
  const d = parseFloat(discount) || 0;
  const t = parseFloat(taxRate) || 0;
  
  console.log("DEBUG finalPrice PARSED:", { p, d, t });
  
  let finalPrice;
  
  // Handle undefined/null taxType by defaulting to exclusive
  const normalizedTaxType = (taxType || 'exclusive').toString().toLowerCase().trim();
  console.log("DEBUG normalizedTaxType:", normalizedTaxType, "Comparison:", normalizedTaxType === 'inclusive');
  
  if (normalizedTaxType === 'inclusive') {
    // For inclusive tax: price already includes tax, just subtract discount
    finalPrice = p - d;
    console.log("DEBUG inclusive calculation:", p, "-", d, "=", finalPrice);
  } else {
    // For exclusive tax: add tax to the price after discount
    finalPrice = p - d + (p * t);
    console.log("DEBUG exclusive calculation:", p, "-", d, "+", "(", p, "*", t, ") =", finalPrice);
  }
  return finalPrice.toFixed(2);
});

Handlebars.registerHelper("isValidNote", function (note, options) {
  return note &&
      note !== null &&
      note !== "null" &&
      note.toString().trim() !== ""
      ? options.fn(this)
      : options.inverse(this);
});

Handlebars.registerHelper("hasWarranty", function (warranty) {
  return warranty && warranty.trim && warranty.trim() !== "";
});

const formatDate = (date) => {
  if (!date) return "";
  // Convert UTC time to Sri Lankan time using timeZone utility
  const sriLankanTime = formatToSriLankaTime(date);
  return sriLankanTime ? sriLankanTime.full : "";
};

const template = Handlebars.compile(`
<div style="font-family: Arial, sans-serif; position: absolute; left: 0; top: 0;">
    <style>
        /* Base Styles */
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            color: #333;
        }
        
        /* Print Styles */
        @media print {
            body, .print-container {
                margin: 0 !important;
                padding: 0 !important;
            }
            @page {
                size: A5 portrait;
                margin: 0;
                padding: 0;
            }
            .product-row {
                page-break-inside: avoid;
            }
            .page-break {
                page-break-before: always;
            }
        }
        
        /* Receipt Container */
        .receipt-container {
            width: 148mm;
            min-height: 210mm;
            margin: 0;
            padding: 10mm;
            background-color: white;
            border: 1px solid #d1d5db;
            box-shadow: none;
            page-break-inside: avoid;
        }
        
        .print-container {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        
        /* Company Header */
        .company-header {
            text-align: center;
            color: #000000;
            margin-bottom: 20px;
        }
        
        .logo-container {
            width: 100%;
            text-align: center;
            margin-bottom: 8px;
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #000000;
            margin-bottom: 2px;
        }
        
        .company-tagline {
            font-size: 12px;
            color: #666;
            margin-bottom: 15px;
        }
        
        /* Invoice Meta Section */
        .invoice-meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            margin-top: 30px;
            font-size: 15px;
            color: #000000;
        }
        
        .meta-left {
            flex: 1;
            text-align: left;
        }
        
        .meta-right {
            text-align: right;
        }
        
        .meta-item {
            margin-bottom: 3px;
            color: #000000;
        }
        
        /* Divider Line */
        .divider {
            width: 100%;
            border-top: 1px solid #000;
            margin: 8px 0;
            margin-top: 30px;
        } 
        
        /* Products Section */
        .products-section {
            margin-top: 8px;
        }
        
        .products-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            color: #000000;
        }
        
        .products-table th,
        .products-table td {
            border: 1px solid black;
            padding: 8px;
        }
        
        .products-table th {
            font-weight: bold;
            background-color: #f8f9fa;
        }
        
        .product-name {
            word-wrap: break-word;
            line-height: 1.2;
        }
        
        /* Payment Summary */
        .payment-summary {
            display: flex;
            justify-content: space-between;
            margin-top: 18px;
            font-size: 15px;
            color: #000000;
        }
        
        .payment-left {
            flex: 1;
        }
        
        .payment-right {
            flex: 1;
            text-align: right;
        }
        
        .payment-item {
            margin-bottom: 3px;
            font-size: 12px;
        }
        
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1px;
            font-size: 12px;
        }
        
        .summary-row.total {
            font-size: 12px;
            margin-top: 5px;
        }

        .barcode-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 16px;
        }
        
        .system-by {
            font-size: 14px;
            text-align: center;
            margin-top: 4px;
            color: #000000;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>

    <!-- Company Header Section -->
    <div class="receipt-container">
        <!-- Company Header -->
        <div class="company-header">
            <!-- Logo Container -->
            {{#if settings.logo}}
            <div style="overflow: hidden; display: flex; justify-content: center; align-items: center;">
                <img src="{{settings.logo}}" alt="Logo" style="max-height: 100px; max-width: 100%; margin: 2px auto;">
            </div>
            {{/if}}
        </div>

        <!-- Invoice Meta Section -->
        <div class="invoice-meta">
            <!-- Left: Company and Customer Info -->
            <div class="meta-left">
                <div class="meta-item" style="font-size:14px;"><b>{{settings.companyName}}</b><br>{{settings.companyAddress}}</div>
                <!-- Fixed: Ensure company mobile is displayed with fallback -->
                <div class="meta-item" style="font-size:14px;">
                    <b>Mobile:</b> 
                    {{settings.companyMobile}} / 0762473808
                    <br> <div class="meta-item" style="font-size:14px;"><b>Email:</b> {{settings.companyEmail}}</div>
                </div>
                <div class="meta-item" style="font-size:12px; margin-top:10px;"><b>Employee:</b> {{newSale.cashierUsername}}</div>
                <div class="meta-item" style="font-size:14px;"> <br>
                   <b>Bill To:</b> <b>{{newSale.customer}}</b>
                </div>
                
            </div>

            <!-- Right: Invoice Info -->
            <div class="meta-right">
                <div style="text-align: right; margin-bottom: 5px;">
                    <b style="font-size: 26px;">RECEIPT</b>
                </div>
                <table style="border-collapse: collapse; margin-left: auto;">
                    <tr>
                        <td style="border: 1px solid black; padding: 4px 8px;"><b>Date:</b></td>
                        <td style="border: 1px solid black; padding: 4px 8px;">{{newSale.date}}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid black; padding: 4px 8px;"><b>Receipt No:</b></td>
                        <td style="border: 1px solid black; padding: 4px 8px;">{{newSale.invoiceNumber}}</td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Products Section -->
        <div class="products-section">
            <table class="products-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">Description</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Rate</th>
                        <th style="text-align: right;">Discount</th>
                        <th style="text-align: right;">Amount (LKR)</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each newSale.productsData}}
                    <tr>
                        <td style="text-align: left;" class="product-name">
                            {{this.name}}
                            {{#if this.warranty}}
                                <br>
                                <span style="font-size: 10px; color: #000000;">Warranty: {{this.warranty}}</span>
                            {{/if}}
                            {{#if this.appliedWholesale}}
                                <span style="display: inline-block; background-color: #f3f4f6; color: #000000; border: 1px solid #000000; border-radius: 4px; padding: 1px 4px; font-size: 12px; font-weight: bold; margin-left: 4px;">
                                    W
                                </span>
                            {{/if}}
                        </td>
                        <td style="text-align: center;">{{this.quantity}} pcs</td>
                        <td style="text-align: right;">{{formatCurrency (getDisplayPrice this.price this.discount this.taxRate this.taxType)}}</td>
                        <td style="text-align: right;">{{formatCurrency (multiply this.specialDiscount this.quantity)}}</td>
                        <td style="text-align: right;">LKR {{formatCurrency this.subtotal}}</td>
                    </tr>
                    {{/each}}
                    <tr style="font-weight: bold;">
                        <td colspan="4" style="text-align: right;">Total:</td>
                        <td style="text-align: right;">LKR {{formatCurrency newSale.baseTotal}}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="divider"></div>

        <!-- Payment Summary -->
        <div class="payment-summary">
            <div class="payment-left">
                <!-- Payment Methods -->
                {{#each newSale.paymentType}}
                <div class="payment-item">
                    {{#if (eq this.type "bank_transfer")}}Bank Transfer
                    {{else if (eq this.type "cash")}}Cash
                    {{else if (eq this.type "card")}}Card
                    {{else}}Unknown
                    {{/if}}: {{formatCurrency this.amount}}
                </div>
                {{/each}}
                
                {{#if (eq newSale.paymentStatus "unpaid")}}
                <div class="payment-item">Paid Amount: 0.00</div>
                <div class="payment-item">Due Amount: {{formatCurrency newSale.grandTotal}}</div>
                {{else}}
                <div class="payment-item">Balance: {{formatCurrency newSale.cashBalance}}</div>
                {{/if}}
            </div>

            <div class="payment-right">
                <!-- Loyalty Points Section -->
                <div class="summary-row">
                    <span><b>Claimed Points:</b></span>
                    <span>{{formatPoints newSale.claimedPoints}}</span>
                </div>
                <div class="summary-row">
                    <span><b>Redeemed Points From Sale:</b></span>
                    <span>{{formatPoints newSale.redeemedPointsFromSale}}</span>
                </div>
                
                <!-- Financial Summary -->
                <div class="summary-row">
                    <span><b>Subtotal:</b></span>
                    <span>LKR {{formatCurrency newSale.baseTotal}}</span>
                </div>
                <div class="summary-row">
                    <span><b>Discount:</b></span>
                    <span>(-) LKR {{formatCurrency newSale.discount}}</span>
                </div>
                <div class="summary-row total">
                    <span><b>Total:</b></span>
                    <span>LKR {{formatCurrency newSale.grandTotal}}</span>
                </div>
            </div>
        </div>

        {{#isValidNote newSale.note}}
            <div style="margin-bottom:10px; font-size: 15px; word-wrap: break-word; overflow-wrap: break-word;">
                <p style="margin-top: 3px; margin-bottom: 3px; font-size: 12px; white-space: pre-wrap; word-break: break-word;">
                Note: {{newSale.note}}
                </p>
            </div>
        {{/isValidNote}}

        <!-- Barcode Section -->
        <div class="barcode-container" style="position: absolute; right: 14mm; bottom: 2mm; width: 120px; display: flex; flex-direction: column; align-items: center;">
            <svg id="barcode-{{newSale.invoiceNumber}}"></svg>
            <p class="system-by" style="text-align: center; margin-top: 4px;">System by IDEAZONE</p>
        </div>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                try {
                    JsBarcode('#barcode-{{newSale.invoiceNumber}}', '{{newSale.invoiceNumber}}', {
                        format: 'CODE128',
                        width: 1.2,
                        height: 25,
                        fontSize: 14,
                        margin: 2,
                        displayValue: true
                    });
                } catch (e) {
                    console.error('Barcode generation error:', e);
                }
            });
        </script>
        
        <!-- Terms and Conditions Section -->
        <div style="position: absolute; left: 10mm; bottom: 10mm; width: 60%; font-size: 10px; color: #333; text-align: left; line-height: 1.4;">
            <b>Terms and Conditions</b>
            <ul style="padding-left: 16px; margin: 6px 0 0 0;">
                <li>14 days required for warranty coverage.</li>
                <li>Burn marks, physical damage, and corrosion are not covered by warranty.</li>
                <li>Warranty covers only manufacturer's defects. Damage or defects caused by negligence, misuse, improper operation, power fluctuation, lightning, or other natural disasters are not covered.</li>
                <li>Sabotage or accidents are not included under this warranty.</li>
                <li>Invoice must be produced for warranty claims. Warranty is void if the sticker is removed or damaged.</li>
                <li>Goods once sold are not returnable under any circumstances.</li>
            </ul>
            <br>
            <b>THANK YOU FOR YOUR BUSINESS!</b>
        </div>
    </div>
</div>
`);

module.exports = {
  generateReceiptA4: (data) => {
    // Use the backend-formatted date from sale data
    return template(data);
  },
  getBarcodeScriptA4: () => {
    return `
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                JsBarcode('#barcode-{{newSale.invoiceNumber}}', '{{newSale.invoiceNumber}}', {
                    format: 'CODE128',
                    width: 1.2,
                    height: 30,
                    fontSize: 14,
                    margin: 5,
                    displayValue: true
                });
            });
        </script>
        `;
  },
};