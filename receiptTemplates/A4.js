const Handlebars = require('handlebars');

Handlebars.registerHelper('formatCurrency', function (number) {
    if (isNaN(number)) return '0.00';
    const [integerPart, decimalPart] = parseFloat(number).toFixed(2).split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${formattedInteger}.${decimalPart}`;
});

Handlebars.registerHelper('countProducts', function (products) {
    return products?.length || 0;
});

Handlebars.registerHelper('addOne', function (index) {
    return index + 1;
});

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
            {
                                    width: "210mm", // A4 landscape width
                                    minHeight: "297mm", // A4 landscape height
                                    margin: "0 auto",
                                    boxShadow: "none",
                                    pageBreakInside: "avoid"
                                }
        
        /* Print Styles */
        @media print {
                body, .print-container {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                @page {
                    size: A4 portrait;
                    margin:0;
                    padding:0;
                }
            }
            .product-row {
                page-break-inside: avoid;
            }
            .page-break {
                page-break-before: always;
            }
        
        /* Receipt Container */
        .receipt-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 6px 2px 1px 2px;
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
        
        /* Logo Section */
        .logo-container {
            text-align: center;
        }
        
        .logo-img {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            padding: 0;
        }
        
        .logo-placeholder {
            text-align: center;
            font-size: 14px;
        }
        
        /* Company Header */
        .company-header {
            text-align: center;
            text-color: #000000;
        }

        .company-body {
            text-align:left;
            text-color: #000000;
            display:flex;
            justify-content: space-between;
        }
        
        .company-name {
            font-size: 20px;
            font-weight: bold;
            padding-bottom: 1px;
            text-align:center;
            text-color: #000000;
        }
        
        .company-details {
            font-size: 18px;
            margin: 4px 0;
            text-color: #000000;
        }
        
        /* Divider Line */
        .divider {
            width: 100%;
            border-top: 1px solid #000;
            margin: 4px 0;
        }
        
        /* Invoice Meta Data */
        .invoice-meta {
            text-align: center;
            text-color: #000000;
        }
        
        .invoice-title {
            font-size: 16px;
            font-weight: 600;
            padding-bottom: 4px;
            text-color: #000000;
        }
        
        .invoice-details {
            margin-top: 4px;
            text-color: #000000;
        }
        
        .invoice-detail {
            font-size: 16px;
            margin: 2px 0;
            text-color: #000000;
        }
        
        /* Products Table */
        .products-table {
            width: 98%;
            font-size: 14px;
            border-collapse: collapse;
            margin-top: 4px;
            margin-left: 12px;
            margin-right: 12px;
            text-color: #000000;
        }
        
        .products-table th {
            text-align: left;
            padding: 4px;
            text-color: #000000;
        }
        
        .products-table th.text-left {
            text-align: left;
        }
        
        .products-table th.text-center {
            text-align: center;
        }
        
        .products-table th.text-right {
            text-align: right;
        }
        
        .products-table td {
            padding: 4px;
        }
        
        .product-name {
            white-space: normal;
            word-break: break-word;
            vertical-align: top;
            text-color: #000000;
        }
        
        /* Payment Summary */
        .payment-summary {
            margin-top: 8px;
            text-color: #000000;
        }
        
        .payment-divider {
            width: 100%;
            border-top: 1px solid #000;
            margin: 8px 0;
        }
        
        .payment-row {
            display: flex;
            justify-content: flex-end;
            margin: 4px;
        }
        
        .payment-methods {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
            margin: 4px;
            text-color: #000000;
        }
        
        .payment-method {
            font-size: 14px;
            text-align: right;
            text-color: #000000;
        }
        
        /* Footer Section */
        .footer {
            margin-top: 4px;
            text-color: #000000;
        }
        
        .footer-divider {
            width: 100%;
            border-top: 1px solid #000;
            margin: px 0;
        }
        
        .footer-notice {
            font-size: 12px;
            text-align: center;
            margin: 1px;
            text-color: #000000;
        }
        
        .footer-note {
            display: flex;
            font-size: 12px;
            margin-top: 1px;
            text-color: #000000;
        }
        
        .footer-thanks {
            font-size: 12px;
            text-align: center;
            margin: 1px;
            text-color: #000000;
        }
        
        .signature {
            display: flex;
            justify-content: flex-start;
            margin-top: 16px;
            text-color: #000000;
        }
        
        .signature-text {
            font-size: 14px;
        }
        
        .barcode-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 16px;
        }
        
        .system-by {
            font-size: 12px;
            text-align: center;
            margin-top: 4px;
            text-color: #000000;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>

    <!-- Company Header Section -->
   <div class="receipt-container">
        <!-- Company Header -->
        <div class="company-header" style="text-align: center; width: 100%; margin-bottom: 2px;">
        <!-- Logo and Company Name (flex row) -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 2px;">
            {{#if settings.logo}}
            <div style="flex: 0 0 auto;">
                <img src="{{settings.logo}}" alt="Company Logo" style="max-height: 50px; max-width: 100%;">
            </div>
            {{/if}}
        </div>
        
        <!-- Address and Mobile (stacked below) -->
        <div style="margin: 0 auto; max-width: 90%;">
            <p style="font-size: 14px; margin: 0; padding-bottom: 0; text-align: center;">
                {{settings.companyAddress}}
            </p>
            <p style="font-size: 14px; margin: 0; text-align: center;">
                {{settings.companyMobile}}
            </p>
        </div>
    </div>

        <!-- Invoice Meta Data -->
        <div style="margin-left: 5px; margin-right: 5px;" class="company-body">
            <p style="font-size: 12px; margin:0;">Employee: {{newSale.cashierUsername}}</p>
            <p style="font-size: 12px; margin:0;">RECEIPT NO: {{newSale.invoiceNumber}}</p>
        </div>

        <!-- Customer Details -->
        <div class="customer-details" style="display:flex; justify-content:space-between;margin-left: 5px; margin-right: 5px">
            <p style="font-size: 14px; margin:0; padding-bottom:1px;">{{newSale.date}}</p>
            <p style="font-size: 14px; margin:0; padding-bottom:1px">Customer: {{newSale.customer}}</p>
        </div>

        <div class="divider"></div>

        <!-- Products Table -->
        <table class="products-table" style="style="height: 160px; display: block; overflow-y: auto;">
    <thead>
        <tr>
            <th style="text-align: left;">PRODUCT</th>
            <th style="text-align: left;">PRICE</th>
            <th style="text-align: center;">QTY</th>
            <th style="text-align: right;">AMOUNT</th>
        </tr>
    </thead>
    <tbody>
        {{#each newSale.productsData}}
        <tr>
                        <td style="text-align: left; text-color: #000000;">
                            {{this.name}}
                            {{#if this.warranty}}
                                <span style="font-size: 11px; color: #2E86C1; font-weight: bold; background-color: #EBF5FB; padding: 1px 4px; border-radius: 3px; margin-left: 5px;">
                                    ({{this.warranty}} warranty)
                                </span>
                            {{/if}}
                        </td>
            <td style="text-align: left; text-color: #000000;">{{formatCurrency this.price}}</td>
            <td style="text-align: center; text-color: #000000;;">{{this.quantity}}</td>
            <td style="text-align: right; text-color: #000000;">{{formatCurrency this.subtotal}}</td>
        </tr>
        {{/each}}
    </tbody>
</table>
<div class="divider"></div>
       <!-- Payment Summary -->
<div class="payment-summary" style="font-size: 14px; text-align: right; margin-top: 2px; margin-left: 5px; margin-right: 5px;">
    <div class="summary-row">
        <span>Sale Total:</span>
        <span>{{formatCurrency newSale.grandTotal}}</span>
    </div>
    <div class="summary-row">
        <span>Discount:</span>
        <span>{{formatCurrency newSale.discount}}</span>
    </div>
     <div class="summary-row">
        <span>Balance :</span>
        <span>{{formatCurrency newSale.cashBalance}}</span>
    </div>

    {{#each newSale.paymentType}}
    <tr style="text-align: right; padding: 2px 0; font-size: 12px;">
        <td colspan="4" > {{#if (eq this.type "bank_transfer")}}Bank Transfer
    {{else if (eq this.type "cash")}}Cash
    {{else if (eq this.type "card")}}Card
    {{else}}Unknown
    {{/if}}:</td>
        <td >{{formatCurrency this.amount}}</td>
    </tr>
    {{/each}}
</div>

     {{#if newSale.note}}
        <div style="margin-bottom:4px; font-size: 12px;  word-wrap: break-word; overflow-wrap: break-word;">
            <p style="font-size: 12px; white-space: pre-wrap; word-break: break-word;">
            Note:{{newSale.note}}
        </p>
        </div>
        {{/if}}

        <!-- Footer Section -->
        <div class="footer">
            <p style="text-align: center; font-size: 11px; text-color: #000000;">*** *NO EXCHANGE* *NO CASH REFUND* *NO WARRANTY FOR PHYSICAL BURN MARK, LIGHTING DAMAGE* *** <br/> THANK YOU FOR SHOPPING WITH US!</p>
            
            <div className="flex justify-start mt-5">
                <p style="text-left: center; font-size: 12px; margin-left:5px;">Signature  _________________________________</p>
            </div>
            
            <!-- Barcode Section -->
            <div class="barcode-container">
                <svg id="barcode-{{newSale.invoiceNumber}}"></svg>
            </div>
            <p style="text-align: center; font-size: 11px; text-color: #000000;">System by IDEAZONE</p>
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

        </div>
    </div>
</div>
`);

module.exports = {
    generateReceiptA4: (data) => {
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
    }
};