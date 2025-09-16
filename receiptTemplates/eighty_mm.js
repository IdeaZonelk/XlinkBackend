const Handlebars = require("handlebars");
const moment = require("moment-timezone");

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

Handlebars.registerHelper("abs", function (value) {
  return Math.abs(value);
});

Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

Handlebars.registerHelper("multiply", function (a, b) {
  if (isNaN(a) || isNaN(b)) return "0.00";
  return (a * b).toFixed(2);
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
  
  console.log("DEBUG final result:", finalPrice.toFixed(2));
  return finalPrice.toFixed(2);
});

const formatDate = (date) => {
  if (!date) return "";
  // Convert UTC time to Sri Lankan time (Asia/Colombo timezone)
  const sriLankanTime = moment.utc(date).tz("Asia/Colombo");
  return sriLankanTime.format("MMM DD, YYYY HH:mm");
};

const template = Handlebars.compile(`
<div style="font-family: Arial, sans-serif; max-width: 80mm; margin: 0; padding: 10px; border: 1px solid #ccc; position: fixed; left: 0; top: 0;">
            <style>
    @media print {
        body, html {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
        }
        @page {
            margin: 0 !important;
            padding: 0 !important;
            size: auto;
        }
        div {
            page-break-inside: avoid;
        }
        .avoid-break {
            page-break-inside: avoid;
        }
    }
    * {
        box-sizing: border-box;
    }
    </style>

        <!-- Script to generate barcode (will run when HTML is rendered) -->
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    JsBarcode('#barcode-{{newSale.invoiceNumber}}', '{{newSale.invoiceNumber}}', {
                    format: 'CODE128',
                    width: 1.2,
                    height: 30,
                    fontSize: 13,
                    margin: 5,
                    displayValue: true
                });
            });
            </script>
        
        <div style="text-align: center; margin-bottom: 10px; page-break-inside: avoid;">
            {{#if settings.logo}}
                <div style="
                    width: 32mm; 
                    height: 32mm; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    margin: 0px auto; 
                    overflow: hidden; 
                    background: transparent;
                    ">
                <img 
                    src="{{settings.logo}}" 
                    alt="Logo" 
                    style="
                    max-width: 100%; 
                    max-height: 100%; 
                    object-fit: contain;">
                </div>
            {{/if}}
            <p style="margin: 1.5px 0; font-size: 12px;">{{settings.companyAddress}}</p>
            <p style="margin: 1.5px 0; font-size: 12px;">{{settings.companyMobile}}</p>
        </div>

        <!-- Transaction Info -->
            <div style="margin-bottom: 10px;">
                <p style="margin: 2.5px 0; font-size: 11px;">Salesman: {{newSale.cashierUsername}}</p>
                <p style="margin: 2.5px 0; font-size: 11px;">Receipt No: {{newSale.invoiceNumber}}</p>
                <p style="margin: 2.5px 0; font-size: 11px;">Date: {{newSale.date}}</p>
                <p style="margin: 2.5px 0; font-size: 11px;">Customer: {{newSale.customer}}</p>
            </div>

        <!-- Products Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
            <thead>
                <tr>
                    <th colspan="2" style="text-align: left; font-size: 12px; padding-left:20px ">Price</th>
                    <th style="text-align: center; font-size: 12px; vertical-align: top; padding-left:20px">Qty</th>
                    <th style="text-align: center; font-size: 12px; padding-left:5px">Discount</th>
                    <th style="text-align: right; font-size: 12px; vertical-align: top;">Amount</th>
                </tr>
            </thead>
        <tbody>
            {{#each newSale.productsData}}
            <tr>
                <td colspan="5" style="font-size: 12px; font-weight: bold; padding-top: 6px; padding-bottom: 2px;">
                    {{addOne @index}}. {{this.name}}
                    {{#if this.warranty}}
                        <span style="font-size: 10px; color: #2E86C1; font-weight: bold; background-color: #EBF5FB; padding: 1px 4px; border-radius: 3px; margin-left: 5px;">
                        ({{this.warranty}} warranty)
                        </span>
                    {{/if}}
                </td>
            </tr>

            <tr>
                <td></td>
               <td style="padding: 2px 0; font-size: 13px; padding-left:20px">
            {{formatCurrency (getDisplayPrice this.price this.discount this.taxRate this.taxType)}}
        </td>
                <td style="text-align: center; padding: 2px 0; font-size: 13px; padding-left:20px">{{this.quantity}}</td>
                <td style="padding: 2px 0; font-size: 13px; padding-left:20px">{{formatCurrency (multiply this.specialDiscount this.quantity)}}</td>
                <td style="text-align: right; padding: 2px 0; font-size: 13px;">{{formatCurrency this.subtotal}}</td>
            </tr>
            {{/each}}
        </tbody>
       <tfoot>
    <tr><td colspan="4" style="padding-top: 8px;"></td></tr>
    <tr>
</tr>
    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Total:</td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{formatCurrency newSale.grandTotal}}</td>
    </tr>

    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Discount:</td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{formatCurrency newSale.discount}}</td>
    </tr>

<tr>
    <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Claimed Points:</td>
    <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{newSale.claimedPoints}}</td>
</tr>


{{#if newSale.redeemedPointsFromSale}}
<tr>
    <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Redeemed Points:</td>
    <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{newSale.redeemedPointsFromSale}}</td>
</tr>
{{/if}}

    {{#if (eq newSale.paymentStatus "unpaid")}}
    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Paid :</td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">0.00</td>
    </tr>
    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Due :</td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{formatCurrency newSale.grandTotal}}</td>
    </tr>
    {{/if}}
    
    {{#unless (eq newSale.paymentStatus "unpaid")}}
    <!-- Payment Details Rows -->
    {{#each newSale.paymentType}}
    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">
    {{#if (eq this.type "bank_transfer")}}Bank Transfer
    {{else if (eq this.type "cash")}}Cash
    {{else if (eq this.type "card")}}Card
    {{else}}Unknown
    {{/if}}:
  </td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{formatCurrency this.amount}}</td>
    </tr>
    {{/each}}
    <tr>
        <td colspan="4" style="text-align: right; padding: 1.5px 0; font-size: 13px;">Balance:</td>
        <td style="text-align: right; padding: 1.5px 0; font-size: 13px;">{{formatCurrency (abs newSale.cashBalance)}}</td>
    </tr>
    {{/unless}}
        </tfoot>
    </table>

    <!-- Notes Section - Updated with text wrapping -->
    {{#if newSale.note}}
        <div style="margin-bottom:10px; font-size: 11px;  word-wrap: break-word; overflow-wrap: break-word;">
            <p style="margin-top: 2.5px; 0; margin-bottom: 2.5px font-size: 11px; white-space: pre-wrap; word-break: break-word;">
            Note:{{newSale.note}}
        </p>
        </div>
        {{/if}}

        <!-- Footer -->

        {{#if newSale.totalSavedAmount}}
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
            <div style="text-align: center; font-size: 19px; font-weight: bold;">
                ඔබේ ලාභය : {{formatCurrency newSale.totalSavedAmount}}
            </div>
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
        {{/if}}


        <div style="text-align: center; margin-top: 15px; font-size: 0.8em;">
        <p style="margin: 3.5px 0;">
            THANK YOU FOR SHOPPING WITH US!<br>
            Items can be returned within 3 days from the date of purchase, with the original bill.<br><br>
        </p>

        <!-- Barcode Section -->
        <div style="text-align: center; margin: 10px 0;">
            <canvas id="barcode-{{newSale.invoiceNumber}}"></canvas>
        </div>
         <p style="margin: 3.5px 0;">
            System by IDEAZONE
        </p>
        </div>
        </div>
`);

module.exports = {
  generateReceiptEighty: (data) => {
    // Format the date before passing to template
    const formattedData = {
      ...data,
      newSale: {
        ...data.newSale,
        date: formatDate(new Date()),
      },
    };
    return template(formattedData);
  },
  getBarcodeScriptEighty: () => {
    return `
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <script>
            document.addEventListener('DOMContentLoaded', function() {
                JsBarcode('#barcode-{{newSale.invoiceNumber}}', '{{newSale.invoiceNumber}}', {
                    format: 'CODE128',
                    width: 1.2,
                    height: 30,
                    fontSize: 13,
                    margin: 5,
                    displayValue: true
                });
            });
        </script>
        `;
  },
};
