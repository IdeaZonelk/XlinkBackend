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

Handlebars.registerHelper("formatMobile", function (mobileNumber) {
  if (!mobileNumber) return "N/A";
  const digits = mobileNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `${digits.substring(0, 3)}-${digits.substring(
      3,
      6
    )}-${digits.substring(6)}`;
  }

  return mobileNumber;
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


// Register sum helper to calculate total of product subtotals
Handlebars.registerHelper("sum", function (products) {
  if (!Array.isArray(products)) return 0;
  return products.reduce((total, product) => {
    return total + (product.subtotal || 0);
  }, 0);
});

// Register subtract helper
Handlebars.registerHelper("subtract", function (a, b) {
  return (a || 0) - (b || 0);
});

// Register formatMobile helper (from previous error)
Handlebars.registerHelper("formatMobile", function (mobileNumber) {
  if (!mobileNumber) return "N/A";
  const digits = mobileNumber.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.substring(0, 3)}-${digits.substring(
      3,
      6
    )}-${digits.substring(6)}`;
  }
  return mobileNumber;
});

Handlebars.registerHelper("multiply", function (a, b) {
  if (isNaN(a) || isNaN(b)) return "0.00";
  return (a * b).toFixed(2);
});

const formatDate = (date) => {
  if (!date) return "";
  // Convert UTC time to Sri Lankan time (Asia/Colombo timezone)
  const sriLankanTime = moment.utc(date).tz("Asia/Colombo");
  return sriLankanTime.format("MMM DD, YYYY HH:mm");
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
                
                .col-discount {
                    flex: 1.5;
                    text-align: center;
                }
                
                .col-quantity {
                    flex: 1.5;
                    text-align: center;
                }
                
                .col-price {
                    flex: 1.5;
                    text-align: center;
                }
                
                .col-subtotal {
                    flex: 1.5;
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
                        <div class="meta-item"><b>Customer:</b> {{newSale.customerName}}</div>
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
                        <div class="col-discount">Discount</div>
                        <div class="col-subtotal">Subtotal</div>
                    </div>

                    {{#each newSale.productsData}}
                    <div class="product-row">
                        <div class="col-product">
                            <div class="product-name">{{this.name}} 
                                {{#if this.warranty}}
                                <span style="font-size: 11px; color: #2E86C1; font-weight: bold; background-color: #EBF5FB; padding: 1px 4px; border-radius: 3px; margin-left: 5px;">
                                    ({{this.warranty}} warranty)
                                </span>
                            {{/if}}
                            </div>
                        </div>
                        <div class="col-quantity">{{this.quantity}} pcs</div>
                        <div class="col-price">{{formatCurrency (getDisplayPrice this.price this.discount this.taxRate this.taxType)}}</div>                        
                        <div class="col-discount">{{formatCurrency (multiply this.specialDiscount this.quantity)}}</div>
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
                            <b> {{#if (eq this.type "bank_transfer")}}Bank Transfer
    {{else if (eq this.type "cash")}}Cash
    {{else if (eq this.type "card")}}Card
    {{else}}Unknown
    {{/if}}:</b> {{formatCurrency this.amount}}
                        </div>
                        {{/each}}
                            {{#if (eq newSale.paymentStatus "unpaid")}}
                            <div class="payment-item">
                                <b>Paid Amount :</b> 0.00
                            </div>
                            <div class="payment-item">
                                <b>Due Amount :</b> {{formatCurrency newSale.grandTotal}}<br>
                                <span>(+shipping,tax)</span>
                            </div>
                            {{else}}
                            <div class="payment-item">
                                <b>Total Paid :</b> {{formatCurrency newSale.grandTotal}}
                            </div>
                            {{/if}}
                    </div>

                    <div class="payment-right">
                        <!-- Calculate subtotal as sum of all products -->
                        <div class="summary-row">
                            <span><b>Subtotal:</b></span>
                            <span>Rs {{formatCurrency (sum newSale.productsData)}}</span>
                        </div>
                        <div class="summary-row">
                            <span><b>Claimed Points:</b></span>
                            <span>{{newSale.claimedPoints}}</span>
                        </div>
                        <div class="summary-row">
                            <span><b>Discount:</b></span>
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

                <!-- Footer Message -->
                <div style="text-align: center; margin-top: 20px; font-size: 12px;">
                    <p style="margin: 5px 0;">
                        <b>THANK YOU FOR SHOPPING WITH US!</b><br>
                        Items can be returned within 3 days from the date of purchase, with the original bill.
                    </p>
                </div>

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
        date: formatDate(new Date()),
      },
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
  },
};
