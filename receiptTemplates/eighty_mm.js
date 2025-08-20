const Handlebars = require("handlebars");

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

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const template = Handlebars.compile(`
<div style="font-family: Arial, sans-serif; max-width: 80mm; margin: 0; padding: 10px; border: 1px solid #ccc; position: fixed; left: 0; top: 0;">
        <!-- Your existing receipt content remains the same -->
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
                    fontSize: 14,
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
            <p style="margin: 2px 0; font-size: 13px;">{{settings.companyAddress}}</p>
            <p style="margin: 2px 0; font-size: 13px;">{{settings.companyMobile}}</p>
        </div>

        <!-- Transaction Info -->
            <div style="margin-bottom: 10px;">
                <p style="margin: 3px 0; font-size: 12px;">Salesman: {{newSale.cashierUsername}}</p>
                <p style="margin: 3px 0; font-size: 12px;">Receipt No: {{newSale.invoiceNumber}}</p>
                <p style="margin: 3px 0; font-size: 12px;">Date: {{newSale.date}}</p>
                <p style="margin: 3px 0; font-size: 12px;">Customer: {{newSale.customer}}</p>
            </div>

        <!-- Products Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
            <thead>
                <tr>
                    <th colspan="2" style="text-align: left; font-size: 13px; padding-left:20px ">Normal<br>Price</th>
                    <th style="text-align: left; font-size: 13px; padding-left:20px">Our<br>Price</th>
                    <th style="text-align: center; font-size: 13px; vertical-align: top; padding-left:20px">Qty</th>
                    <th style="text-align: right; font-size: 13px; vertical-align: top;">Amount</th>
                </tr>
            </thead>
        <tbody>
            {{#each newSale.productsData}}
            <tr>
                <td colspan="5" style="font-size: 13px; font-weight: bold; padding-top: 6px; padding-bottom: 2px;">
                    {{addOne @index}}. {{this.name}}
                    {{#if this.warranty}}
                        <span style="font-size: 11px; color: #2E86C1; font-weight: bold; background-color: #EBF5FB; padding: 1px 4px; border-radius: 3px; margin-left: 5px;">
                        ({{this.warranty}} warranty)
                        </span>
                    {{/if}}
                </td>
            </tr>

            <tr>
                <td></td>
                <td style="padding: 2px 0; font-size: 13px; padding-left:20px">{{formatCurrency this.price}}</td>
                <td style="padding: 2px 0; font-size: 13px; padding-left:20px">{{formatCurrency this.ourPrice}}</td>
                <td style="text-align: center; padding: 2px 0; font-size: 13px; padding-left:20px">{{this.quantity}} PCS</td>
                <td style="text-align: right; padding: 2px 0; font-size: 13px;">{{formatCurrency this.subtotal}}</td>
            </tr>
            {{/each}}
        </tbody>
       <tfoot>
    <tr><td colspan="4" style="padding-top: 8px;"></td></tr>
    <tr>
</tr>

        <tr>
            <td colspan="4" style="text-align: right; padding: 2px 0; font-size: 14px;">Total:</td>
            <td style="text-align: right; padding: 2px 0; font-size: 14px;">{{formatCurrency newSale.grandTotal}}</td>
        </tr>
    <tr>
        <td colspan="4" style="text-align: right; padding: 2px 0; font-size: 14px;">Discount:</td>
        <td style="text-align: right; padding: 2px 0; font-size: 14px;">{{formatCurrency newSale.discount}}</td>
    </tr>
    
    <!-- Payment Details Rows -->
    {{#each newSale.paymentType}}
    <tr>
        <td colspan="4" style="text-align: right; padding: 2px 0; font-size: 14px;">
    {{#if (eq this.type "bank_transfer")}}Bank Transfer
    {{else if (eq this.type "cash")}}Cash
    {{else if (eq this.type "card")}}Card
    {{else}}Unknown
    {{/if}}:
  </td>
        <td style="text-align: right; padding: 2px 0; font-size: 14px;">{{formatCurrency this.amount}}</td>
    </tr>
    
    {{/each}}
        
            <tr>
                <td colspan="4" style="text-align: right; padding: 2px 0; font-size: 14px;">Balance:</td>
                <td style="text-align: right; padding: 2px 0; font-size: 14px;">{{formatCurrency (abs newSale.cashBalance)}}</td>
            </tr>
        </tfoot>
    </table>

    <!-- Notes Section - Updated with text wrapping -->
    {{#if newSale.note}}
        <div style="margin-bottom:10px; font-size: 12px;  word-wrap: break-word; overflow-wrap: break-word;">
            <p style="margin-top: 3px; 0; margin-bottom: 3px font-size: 12px; white-space: pre-wrap; word-break: break-word;">
            Note:{{newSale.note}}
        </p>
        </div>
        {{/if}}

        <!-- Footer -->

        {{#if newSale.totalSavedAmount}}
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
            <div style="text-align: center; font-size: 20px; font-weight: bold;">
                ඔබේ ලාභය : {{formatCurrency newSale.totalSavedAmount}}
            </div>
            <hr style="border-top: 1px dashed #000; margin: 8px 0;">
        {{/if}}


        <div style="text-align: center; margin-top: 15px; font-size: 0.8em;">
        <p style="margin: 4px 0;">
            THANK YOU FOR SHOPPING WITH US!<br><br>
        </p>

        <!-- Barcode Section -->
        <div style="text-align: center; margin: 10px 0;">
            <canvas id="barcode-{{newSale.invoiceNumber}}"></canvas>
        </div>
         <p style="margin: 4px 0;">
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
                    fontSize: 14,
                    margin: 5,
                    displayValue: true
                });
            });
        </script>
        `;
  },
};
