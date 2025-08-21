/*
 * Copyright (c) 2025 Ideazone (Pvt) Ltd
 * Proprietary and Confidential
 *
 * This source code is part of a proprietary Point-of-Sale (POS) system developed by Ideazone (Pvt) Ltd.
 * Use of this code is governed by a license agreement and an NDA.
 * Unauthorized use, modification, distribution, or reverse engineering is strictly prohibited.
 *
 * Contact info@ideazone.lk for more information.
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    currentID: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: String, required: true },
    appliedWholesale: { type: Boolean, default: false },
    applicablePrice: { type: String, required: true },
    ptype: { type: String, required: true },
    discount: { type: Number },
    specialDiscount: { type: Number },
    variationValue: { type: String },
    quantity: { type: Number, required: true },
    stockQty: { type: Number },
    taxRate: { type: Number },
    subtotal: { type: Number, required: true },
    productProfit: { type: Number, required: true, default: 0 },
    warehouse: { type: String, required: true },
    wholesaleEnabled: { type: Boolean, default: false },
    wholesaleMinQty: { type: Number, default: 0 },
    wholesalePrice: { type: Number, default: 0 },
});

const creditDetailsSchema = new mongoose.Schema({
    interestRate: { type: String, default: 0 },
    months: { type: String, default: 0 },
    interestAmount: { type: String, default: 0 },
    monthlyInstallment: { type: String, default: 0 },
});

const saleSchema = new mongoose.Schema({
    refferenceId: { type: String, required: true, unique: true },
    customer: { type: String },
    date: { type: Date, default: Date.now },
    discountType: { type: String },
    discount: { type: String },
    discountValue: { type: String, default: '0' },
    baseTotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    pureProfit: { type: Number, required: true, default: 0 },
    orderStatus: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    useCreditPayment: { type: Boolean, default: false },
    creditDetails: creditDetailsSchema,
    paymentType: [
        {
            type: { type: String, required: true },
            amount: { type: Number, required: true }
        }
    ],
    paidAmount: { type: Number, default: 0 },
    productsData: { type: [productSchema], required: true },
    shipping: { type: String },
    tax: { type: String },
    warehouse: { type: String, required: true, default: null },
    offerPercentage: { type: Number, default: 0 },
    cashierUsername: {
        type: String,
        default: "unknown"
    },
    saleType: { type: String, enum: ['POS', 'Non-POS'], required: true },
    invoiceNumber: { type: String, default: null },
    returnStatus: { type: Boolean, required: true, default: false },
    note: { type: String },
    cashBalance: { type: Number, default: 0 },
    cashRegisterKey: { type: String },
    cashRegisterID: { type: String },
},
    { timestamps: true }
);

const Sale = mongoose.model('sale', saleSchema);

module.exports = Sale;
