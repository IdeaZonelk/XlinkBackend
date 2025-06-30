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

Handlebars.registerHelper('formatMobile', function (mobileNumber) {
    if (!mobileNumber) return 'N/A';
    const digits = mobileNumber.replace(/\D/g, '');

    if (digits.length === 10) {
        return `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
    }

    return mobileNumber;
});

// Register sum helper to calculate total of product subtotals
Handlebars.registerHelper('sum', function (products) {
    if (!Array.isArray(products)) return 0;
    return products.reduce((total, product) => {
        return total + (product.subtotal || 0);
    }, 0);
});

// Register subtract helper
Handlebars.registerHelper('subtract', function (a, b) {
    return (a || 0) - (b || 0);
});

// Register formatMobile helper (from previous error)
Handlebars.registerHelper('formatMobile', function (mobileNumber) {
    if (!mobileNumber) return 'N/A';
    const digits = mobileNumber.replace(/\D/g, '');
    if (digits.length === 10) {
        return `${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}`;
    }
    return mobileNumber;
});

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
                        width: "148mm", // A5 landscape width
                        minHeight: "210mm", // A5 landscape height
                        margin: "0 auto",
                        boxShadow: "none",
                        pageBreakInside: "avoid"
                    }
                
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
                
                .logo-placeholder {
                    height: 60px;
                    background: linear-gradient(45deg, #8B4513, #D2691E, #F4A460, #DEB887);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    color: #654321;
                    position: relative;
                    margin-bottom: 10px;
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
                    margin-top: 30px
                }
                
                /* Products Section */
                .products-section {
                    margin-top: 40px;
                }
                
                .products-header {
                    display: flex;
                    font-weight: bold;
                    font-size: 15px;
                    margin-bottom: 8px;
                    color: #000000;
                }
                
                .col-product {
                    flex: 3;
                    text-align: left;
                }
                
                .col-quantity {
                    flex: 1;
                    text-align: center;
                }
                
                .col-price {
                    flex: 1.2;
                    text-align: right;
                }
                
                .col-subtotal {
                    flex: 1.2;
                    text-align: right;
                }
                
                .product-row {
                    display: flex;
                    font-size: 14px;
                    margin-bottom: 5px;
                    color: #000000;
                    align-items: flex-start;
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
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }
                
                .summary-row.total {
                    font-size: 16px;
                    margin-top: 5px;
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
                    <div style="overflow: hidden; display: flex; justify-content: center; align-items: center; ">
                    <img src="{{settings.logo}}" alt="Logo" style="max-height: 100px; max-width: 100%; margin: 2px auto;">
                    </div>
                </div>

                <!-- Invoice Meta Section -->
                <div class="invoice-meta">
                    <!-- Left: Invoice Meta Data -->
                    <div class="meta-left">
                        <div class="meta-item"><b>Invoice No.</b> {{newSale.invoiceNumber}}</div>
                        <div class="meta-item"><b>Customer</b></div>
                        <div class="meta-item">{{newSale.customer}}</div>
                        <div class="meta-item"><b>Mobile:</b> {{formatMobile settings.companyMobile}}</div>
                    </div>

                    <!-- Right: Date -->
                    <div class="meta-right">
                        <div class="meta-item"><b>Date</b> {{newSale.date}}</div>
                    </div>
                </div>

                <!-- Products Section -->
                <div class="products-section">
                    <div class="products-header">
                        <div class="col-product">Product</div>
                        <div class="col-quantity">Quantity</div>
                        <div class="col-price">Unit Price</div>
                        <div class="col-subtotal">Subtotal</div>
                    </div>

                    {{#each newSale.productsData}}
                    <div class="product-row">
                        <div class="col-product">
                            <div class="product-name">{{this.name}}</div>
                        </div>
                        <div class="col-quantity">{{this.quantity}} pcs</div>
                        <div class="col-price">{{formatCurrency this.price}}</div>
                        <div class="col-subtotal">{{formatCurrency this.subtotal}}</div>
                    </div>
                    {{/each}}
                </div>

                <div class="divider"></div>

                <!-- Payment Summary -->
                <div class="payment-summary">
                    <div class="payment-left">
                        {{#each newSale.paymentType}}
                        <div class="payment-item">
                            <b>{{this.type}}</b> {{formatCurrency this.amount}}
                        </div>
                        {{/each}}
                        <div class="payment-item">
                            <b>Total Paid</b> {{formatCurrency newSale.grandTotal}}
                        </div>
                    </div>

                    <div class="payment-right">
                        <!-- Calculate subtotal as sum of all products -->
                        <div class="summary-row">
                            <span><b>Subtotal:</b></span>
                            <span>Rs {{formatCurrency (sum newSale.productsData)}}</span>
                        </div>
                        <div class="summary-row">
                            <span><b>Discount</b></span>
                            <span>(-) Rs {{formatCurrency newSale.discount}}</span>
                        </div>
                        <div class="summary-row total">
                            <span><b>Total:</b></span>
                            <span>Rs {{formatCurrency (subtract (sum newSale.productsData) newSale.discount)}}</span>
                        </div>
                    </div>
                </div>

                {{#if newSale.note}}
                <div style="margin-bottom:10px; font-size: 14px; word-wrap: break-word; overflow-wrap: break-word;">
                    <p style="font-size: 14px; white-space: pre-wrap; word-break: break-word;">
                        <b>Note:</b> {{newSale.note}}
                    </p>
                </div>
                {{/if}}

                </div>
            </div>
        </div>`);

module.exports = {
    generateReceiptA5: (data) => {
        // Format the date before passing to template
        const formattedData = {
            ...data,
            newSale: {
                ...data.newSale,
                date: formatDate(data.newSale.date)
            }
        };
        return template(formattedData);
    },
    getBarcodeScriptA5: () => {
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